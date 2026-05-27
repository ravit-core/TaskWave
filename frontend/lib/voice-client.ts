/**
 * TaskWave voice client.
 *
 * Owns the WebSocket to /api/voice/stream, the mic capture pipeline
 * (AudioContext → AudioWorklet → PCM16 16 kHz over the WS), and the
 * gap-free playback queue for Gemini's PCM 24 kHz audio output.
 *
 * Supports clean barge-in: when the server signals `interrupted`, we
 * cancel every queued source and reset the playhead so the user can
 * speak over the agent without lingering audio.
 */
import { supabase } from "@/lib/supabase";

const INPUT_RATE = 16_000;
const OUTPUT_RATE = 24_000;

export type AgentState =
  | "idle"
  | "connecting"
  | "ready"
  | "listening"
  | "speaking"
  | "error"
  | "disconnected";

export type TranscriptEvent = {
  role: "user" | "agent";
  text: string;
};

export type ToolResultEvent = {
  tool: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
};

type Listeners = {
  state: (s: AgentState) => void;
  transcript: (t: TranscriptEvent) => void;
  toolResult: (t: ToolResultEvent) => void;
  turnComplete: () => void;
  error: (message: string) => void;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

function wsUrl(): string {
  return BACKEND_URL.replace(/^http/, "ws") + "/api/voice/stream";
}

function base64FromArrayBuffer(buf: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[]
    );
  }
  return btoa(binary);
}

function arrayBufferFromBase64(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export class VoiceClient {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private recorderNode: AudioWorkletNode | null = null;
  private playheadTime = 0;
  private playbackSources: AudioBufferSourceNode[] = [];
  private state: AgentState = "idle";

  // ── Mic gating ──
  // Gate the mic until the agent finishes its opening turn (the
  // greeting). Otherwise the speaker plays the greeting, the mic picks
  // it up, Gemini transcribes that as user speech, the agent responds,
  // → infinite "Welcome back" loop on systems without aggressive echo
  // cancellation. After the first `turn_complete` the mic opens up and
  // normal barge-in works.
  private micGated = true;

  // ── Idle timeout ──
  // Auto-close the session after 60 seconds of NO transcribed activity
  // (neither user speech nor agent speech). Keeps the WS alive through
  // normal thinking pauses but tears it down if the user walked away.
  private static readonly IDLE_TIMEOUT_MS = 60_000;
  private lastActivityAt = 0;
  private idleTimer: ReturnType<typeof setInterval> | null = null;

  private _markActivity() {
    this.lastActivityAt = Date.now();
  }

  private _startIdleWatcher() {
    this._stopIdleWatcher();
    this.lastActivityAt = Date.now();
    this.idleTimer = setInterval(() => {
      if (Date.now() - this.lastActivityAt > VoiceClient.IDLE_TIMEOUT_MS) {
        this._stopIdleWatcher();
        // Soft notice — frontend dashboard surfaces this in the error slot
        this.listeners.error?.(
          "Session ended after 1 minute of silence. Tap the mic to restart."
        );
        this.stop();
      }
    }, 5_000);
  }

  private _stopIdleWatcher() {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private listeners: Partial<Listeners> = {};

  on<K extends keyof Listeners>(event: K, cb: Listeners[K]): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.listeners[event] = cb as any;
  }

  off<K extends keyof Listeners>(event: K): void {
    delete this.listeners[event];
  }

  getState(): AgentState {
    return this.state;
  }

  private setState(next: AgentState) {
    if (this.state === next) return;
    this.state = next;
    this.listeners.state?.(next);
  }

  async start(): Promise<void> {
    if (
      this.state !== "idle" &&
      this.state !== "disconnected" &&
      this.state !== "error"
    ) {
      return;
    }
    this.micGated = true;
    this.setState("connecting");

    if (!supabase) {
      this.setState("error");
      this.listeners.error?.("Supabase not configured");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      this.setState("error");
      this.listeners.error?.("Not signed in");
      return;
    }

    await this.openSocket(token);
  }

  private openSocket(token: string): Promise<void> {
    return new Promise((resolve) => {
      // Defensive: if a prior WS is still alive (from a failed retry,
      // a stuck handshake, or a strict-mode double-mount), strip its
      // handlers and force-close it so it can't keep delivering audio
      // chunks to the same playback queue while the new socket runs.
      if (this.ws) {
        try {
          this.ws.onopen = null;
          this.ws.onmessage = null;
          this.ws.onerror = null;
          this.ws.onclose = null;
          if (
            this.ws.readyState === WebSocket.OPEN ||
            this.ws.readyState === WebSocket.CONNECTING
          ) {
            this.ws.close();
          }
        } catch {
          // ignore — best effort cleanup
        }
        this.ws = null;
      }

      const ws = new WebSocket(wsUrl());
      this.ws = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "hello", token }));
      };

      ws.onmessage = (ev) => this.handleServerMessage(ev.data);

      ws.onerror = () => {
        // Don't set error state here — onclose always follows.
        resolve();
      };

      ws.onclose = () => {
        this.cleanupAudio();
        this.ws = null;
        // Preserve an explicit error state if one was just set (e.g.
        // from a server-side error message). Otherwise plain
        // disconnected — user can tap the mic to restart.
        if (this.state !== "error") this.setState("disconnected");
        resolve();
      };
    });
  }

  private async handleServerMessage(data: unknown) {
    if (typeof data !== "string") return;
    let msg: { type: string } & Record<string, unknown>;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    switch (msg.type) {
      case "ready":
        // Only gate the mic if the server told us a greeting is
        // coming. Otherwise (returning user, silent start) open the
        // mic immediately so the user can talk right away.
        this.micGated = msg.will_greet === true;
        this.setState("ready");
        await this.startMicrophone();
        this.setState("listening");
        this._startIdleWatcher();
        break;

      case "audio": {
        const b64 = msg.data as string;
        if (b64) this.enqueueAudio(b64);
        this._markActivity();
        this.setState("speaking");
        break;
      }

      case "transcript":
        this._markActivity();
        this.listeners.transcript?.({
          role: msg.role as "user" | "agent",
          text: msg.text as string,
        });
        break;

      case "tool_result":
        this._markActivity();
        this.listeners.toolResult?.({
          tool: msg.tool as string,
          args: (msg.args as Record<string, unknown>) ?? {},
          result: (msg.result as Record<string, unknown>) ?? {},
        });
        break;

      case "turn_complete":
        // End of an agent turn. The first one is the greeting — after
        // it finishes, open the mic gate. Subsequent turns keep the
        // gate open so barge-in is preserved.
        this.micGated = false;
        this._markActivity();
        this.listeners.turnComplete?.();
        this.setState("listening");
        break;

      case "interrupted":
        // Hard-clear: stop every queued source AND reset the playhead
        // so the next audio frame starts at the current time, not at a
        // future timestamp from the cancelled turn.
        this.clearPlayback();
        if (this.audioCtx) this.playheadTime = this.audioCtx.currentTime;
        this.setState("listening");
        break;

      case "error":
        this.setState("error");
        this.listeners.error?.((msg.message as string) ?? "Unknown error");
        break;
    }
  }

  // ── Microphone capture ───────────────────────────────────────────
  private async startMicrophone(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioContextCtor({ latencyHint: "interactive" });
    await this.audioCtx.audioWorklet.addModule("/worklets/voice-recorder.js");

    const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
    const recorder = new AudioWorkletNode(this.audioCtx, "voice-recorder");
    recorder.port.onmessage = (ev) => {
      const buf = ev.data as ArrayBuffer;
      this.sendAudio(buf);
    };
    source.connect(recorder);
    // Don't route to destination — we never want to hear ourselves.
    this.recorderNode = recorder;
  }

  private sendAudio(buf: ArrayBuffer) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    // While the greeting is playing, don't forward mic audio — the
    // speaker is currently emitting the greeting and the mic would
    // otherwise capture it and ship it back to Gemini.
    if (this.micGated) return;
    this.ws.send(JSON.stringify({ type: "audio", data: base64FromArrayBuffer(buf) }));
  }

  // ── Playback queue (PCM16 mono @ 24 kHz from Gemini) ────────────
  private enqueueAudio(b64: string): void {
    if (!this.audioCtx) return;

    const buf = arrayBufferFromBase64(b64);
    const pcm = new Int16Array(buf);
    const float = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) float[i] = pcm[i] / 0x8000;

    const ab = this.audioCtx.createBuffer(1, float.length, OUTPUT_RATE);
    ab.copyToChannel(float, 0);

    const src = this.audioCtx.createBufferSource();
    src.buffer = ab;
    src.connect(this.audioCtx.destination);

    const now = this.audioCtx.currentTime;
    const startAt = Math.max(this.playheadTime, now);
    src.start(startAt);
    this.playheadTime = startAt + ab.duration;

    this.playbackSources.push(src);
    src.onended = () => {
      this.playbackSources = this.playbackSources.filter((s) => s !== src);
    };
  }

  private clearPlayback(): void {
    for (const s of this.playbackSources) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
    }
    this.playbackSources = [];
    if (this.audioCtx) this.playheadTime = this.audioCtx.currentTime;
  }

  // ── Teardown ─────────────────────────────────────────────────────
  async stop(): Promise<void> {
    this._stopIdleWatcher();
    try {
      this.ws?.send(JSON.stringify({ type: "end" }));
    } catch {
      // ignore
    }
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    this.cleanupAudio();
    this.setState("disconnected");
  }

  private cleanupAudio() {
    this.clearPlayback();
    this.recorderNode?.disconnect();
    this.recorderNode = null;
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
  }
}
