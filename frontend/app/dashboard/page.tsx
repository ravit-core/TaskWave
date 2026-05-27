"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LogOut,
  ListChecks,
  CalendarDays,
  CheckCircle2,
  Mic,
} from "lucide-react";
import { LayoutGroup } from "framer-motion";

import { useUser } from "@/lib/useUser";
import { supabase } from "@/lib/supabase";
import { listTasks, type Task } from "@/lib/tasks-api";
import { VoiceClient, type AgentState } from "@/lib/voice-client";

import MicButton from "@/components/dashboard/mic-button";
import AgentStatus from "@/components/dashboard/agent-status";
import BoardColumn from "@/components/dashboard/board-column";
import TranscriptOverlay from "@/components/dashboard/transcript-overlay";
import VoiceWave from "@/components/dashboard/voice-wave";

type TranscriptLine = { id: number; role: "user" | "agent"; text: string };

function bucketTasks(tasks: Task[]): {
  today: Task[];
  upcoming: Task[];
  done: Task[];
} {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const today: Task[] = [];
  const upcoming: Task[] = [];
  const done: Task[] = [];

  for (const t of tasks) {
    if (t.status === "done") {
      done.push(t);
      continue;
    }
    if (!t.scheduled_at) {
      today.push(t);
      continue;
    }
    const d = new Date(t.scheduled_at);
    if (d >= start && d < end) today.push(t);
    else if (d >= end) upcoming.push(t);
    else today.push(t); // overdue → still demands attention today
  }

  const byTime = (a: Task, b: Task) => {
    const at = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Number.POSITIVE_INFINITY;
    const bt = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Number.POSITIVE_INFINITY;
    return at - bt;
  };
  today.sort(byTime);
  upcoming.sort(byTime);
  done.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return { today, upcoming, done };
}

export default function DashboardPage() {
  const { user, signOut } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [state, setState] = useState<AgentState>("idle");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const voiceRef = useRef<VoiceClient | null>(null);
  const lineIdRef = useRef(0);

  const refreshTasks = useCallback(async () => {
    try {
      const t = await listTasks({ range: "all", include_done: true });
      setTasks(t);
    } catch {
      // surface only if everything is failing
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  // Keep the user's profiles.timezone in sync with the browser. The voice
  // agent reads this on WebSocket open to resolve "tomorrow morning",
  // "today evening", etc. — without it, the agent defaults to UTC.
  useEffect(() => {
    if (!user?.id || !supabase) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    supabase.from("profiles").update({ timezone: tz }).eq("id", user.id).then(() => {});
  }, [user?.id]);

  useEffect(() => {
    const voice = new VoiceClient();
    voiceRef.current = voice;

    voice.on("state", setState);
    voice.on("error", (msg) => setErrorMsg(msg));
    voice.on("transcript", (t) => {
      setTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === t.role) {
          return [
            ...prev.slice(0, -1),
            { ...last, text: (last.text + " " + t.text).trim() },
          ];
        }
        lineIdRef.current += 1;
        return [...prev, { id: lineIdRef.current, role: t.role, text: t.text }];
      });
    });
    voice.on("turnComplete", () => {
      lineIdRef.current += 1;
    });
    voice.on("toolResult", () => {
      refreshTasks();
    });

    return () => {
      voice.stop();
    };
  }, [refreshTasks]);

  const onMicPress = useCallback(() => {
    const voice = voiceRef.current;
    if (!voice) return;
    setErrorMsg(null);
    if (state === "idle" || state === "disconnected" || state === "error") {
      voice.start();
    } else {
      voice.stop();
      setTranscript([]);
    }
  }, [state]);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const { today, upcoming, done } = useMemo(() => bucketTasks(tasks), [tasks]);
  const activeCount = today.length + upcoming.length;

  return (
    <div className="relative bg-bg lg:h-screen lg:overflow-hidden flex flex-col">
      {/* ── Ambient color blobs (give the glass something to refract) ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[40rem] h-[40rem] rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-[36rem] h-[36rem] rounded-full bg-ochre/15 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/4 w-[40rem] h-[40rem] rounded-full bg-sage/15 blur-[120px]" />
      </div>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="glass shrink-0 sticky top-0 z-20 border-x-0 border-t-0">
        <div className="mx-auto max-w-7xl px-5 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="font-serif text-2xl italic tracking-tight text-ink leading-none shrink-0">
              TaskWave AI
            </h1>
            <span className="hidden sm:inline text-sm text-ink-soft truncate">
              : Voice Controlled Task Manager
            </span>
          </div>
          <div className="flex items-center gap-4">
            {user?.email && (
              <span className="hidden md:inline text-xs text-ink-soft truncate max-w-[18rem]">
                {user.email}
              </span>
            )}
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="h-9 w-9 grid place-items-center rounded-lg text-ink-soft hover:text-ink hover:bg-surface-soft transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl w-full px-5 md:px-8 py-6 lg:py-7 lg:flex-1 lg:min-h-0">
        {/* ── 8 / 4 split with a visible vertical division ─────── */}
        <div className="grid grid-cols-12 gap-6 lg:gap-0 lg:h-full">
          {/* ── Board column ───────────────────────────────────── */}
          <main className="col-span-12 lg:col-span-8 lg:pr-8 xl:pr-10 lg:h-full lg:min-h-0 flex flex-col">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 shrink-0">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-ink-faint mb-1.5">
                  Board
                </p>
                <h2 className="font-serif text-3xl md:text-4xl text-ink leading-tight">
                  Your board
                </h2>
                <p className="text-sm text-ink-soft mt-1.5">
                  {todayLabel}
                  {!tasksLoading && (
                    <>
                      <span className="mx-2 text-ink-faint">·</span>
                      <span>
                        {activeCount} active
                        {done.length > 0 && (
                          <>
                            <span className="mx-2 text-ink-faint">·</span>
                            {done.length} done
                          </>
                        )}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="hidden md:inline-flex items-center gap-2 text-[11px] text-ink-soft px-3 py-1.5 rounded-full bg-surface-soft border border-line">
                <Mic className="h-3 w-3 text-accent-deep" />
                <span>Speak to add, change, or finish a task</span>
              </div>
            </div>

            {tasksLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 lg:flex-1 lg:min-h-0">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-line/80 bg-surface-soft/55 p-3.5 min-h-[18rem] space-y-3"
                  >
                    <div className="h-4 w-24 rounded bg-surface animate-pulse" />
                    <div className="h-16 rounded-lg bg-surface animate-pulse" />
                    <div className="h-16 rounded-lg bg-surface animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <LayoutGroup>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-rows-1 gap-4 lg:gap-5 lg:flex-1 lg:min-h-0">
                  <BoardColumn
                    title="Today"
                    hint="Scheduled for today + overdue + unscheduled"
                    icon={<ListChecks className="h-3.5 w-3.5" />}
                    tasks={today}
                    emptyLabel="Nothing for today yet."
                  />
                  <BoardColumn
                    title="Upcoming"
                    icon={<CalendarDays className="h-3.5 w-3.5" />}
                    tasks={upcoming}
                    emptyLabel="No future tasks scheduled."
                  />
                  <BoardColumn
                    title="Done"
                    accent="muted"
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    tasks={done}
                    emptyLabel="Finish something to see it here."
                  />
                </div>
              </LayoutGroup>
            )}
          </main>

          {/* ── Voice panel ─ a real division: vertical hairline + label ── */}
          <aside className="col-span-12 lg:col-span-4 lg:border-l lg:border-[color:var(--glass-border)] lg:pl-8 xl:pl-10 mt-10 lg:mt-0 lg:h-full lg:min-h-0 flex flex-col">
            <div className="mb-5 hidden lg:block shrink-0">
              <p className="text-[11px] uppercase tracking-[0.22em] text-ink-faint mb-1.5">
                Voice
              </p>
              <h2 className="font-serif text-3xl text-ink leading-tight">
                Voice agent
              </h2>
              <p className="text-sm text-ink-soft mt-1.5">
                Listen, talk, no clicks.
              </p>
            </div>
            <div className="rounded-2xl glass-dark shadow-lg overflow-hidden flex flex-col lg:flex-1 lg:min-h-0">
              {/* Panel header */}
              <div className="px-5 py-3.5 border-b border-[color:var(--glass-dark-border)] flex items-center justify-between shrink-0">
                <h3 className="text-xs uppercase tracking-[0.22em] text-ink-soft">
                  Live session
                </h3>
                <AgentStatus state={state} />
              </div>

              {/* Mic */}
              <div className="px-5 pt-5 pb-4 flex flex-col items-center gap-6 shrink-0">
                <MicButton state={state} onPress={onMicPress} />
                {errorMsg && (
                  <p className="text-xs text-danger text-center max-w-[20rem]">
                    {errorMsg}
                  </p>
                )}
                {/* Sub-mic slot — swaps between the wave (while speaking)
                    and the suggestion hint (when idle/ready). Fixed
                    min-height so the panel doesn't jump on state change. */}
                <div className="min-h-[2rem] w-full flex items-center justify-center">
                  {state === "speaking" ? (
                    <VoiceWave />
                  ) : state === "idle" || state === "ready" || state === "disconnected" ? (
                    <p className="text-xs text-ink-soft text-center max-w-[16rem]">
                      Try: <span className="italic font-serif text-ink">&ldquo;Add &lsquo;buy groceries&rsquo; for 6 PM today.&rdquo;</span>
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Transcript — fills remaining height, scrolls internally */}
              <div className="border-t border-[color:var(--glass-dark-border)] bg-black/15 px-4 py-4 flex flex-col min-h-0 lg:flex-1">
                <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                    Transcript
                  </p>
                  {transcript.length > 0 && (
                    <button
                      onClick={() => setTranscript([])}
                      className="text-[10px] text-ink-faint hover:text-ink-soft transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <TranscriptOverlay lines={transcript} />
                </div>
              </div>

            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
