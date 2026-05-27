// TaskWave voice recorder worklet
//
// Captures the mic stream (usually 48 kHz mono from getUserMedia),
// downsamples to 16 kHz (Gemini Live's expected input rate), converts
// to little-endian 16-bit PCM, and posts the raw ArrayBuffer to the
// main thread once every ~50 ms.
//
// Main thread base64-encodes the buffer and ships it over the WS as
// { type: "audio", data: <base64> }.

const TARGET_RATE = 16000;
const FRAME_MS = 50;
const SAMPLES_PER_POST = Math.round((TARGET_RATE * FRAME_MS) / 1000); // 800

class VoiceRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
    this._ratio = sampleRate / TARGET_RATE; // e.g. 3.0 for 48 kHz input
  }

  // Append to running buffer.
  _append(chunk) {
    const next = new Float32Array(this._buffer.length + chunk.length);
    next.set(this._buffer, 0);
    next.set(chunk, this._buffer.length);
    this._buffer = next;
  }

  // Linear-interp downsample. Cheap and good enough for speech.
  _downsample(input) {
    const outLength = Math.floor(input.length / this._ratio);
    const output = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
      const srcIndex = i * this._ratio;
      const i0 = Math.floor(srcIndex);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const t = srcIndex - i0;
      output[i] = input[i0] * (1 - t) + input[i1] * t;
    }
    return output;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    // Take mono channel 0 (we configure the mic as mono upstream).
    this._append(input[0]);

    while (this._buffer.length * (1 / this._ratio) >= SAMPLES_PER_POST) {
      const neededSrc = Math.ceil(SAMPLES_PER_POST * this._ratio);
      const slice = this._buffer.subarray(0, neededSrc);
      this._buffer = this._buffer.subarray(neededSrc);

      const down = this._downsample(slice);

      // Float32 [-1..1] → Int16 LE
      const pcm = new Int16Array(down.length);
      for (let i = 0; i < down.length; i++) {
        let s = down[i];
        if (s > 1) s = 1;
        if (s < -1) s = -1;
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }

    return true;
  }
}

registerProcessor("voice-recorder", VoiceRecorderProcessor);
