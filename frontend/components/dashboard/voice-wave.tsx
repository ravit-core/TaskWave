"use client";

import { motion } from "framer-motion";

// Equalizer-style audio wave shown while the AI is speaking.
// Five bars, each with a slightly different peak/duration/phase so it
// reads as organic speech rather than a clocked grid pulse.
type Bar = { peak: number; dur: number; delay: number };

const BARS: Bar[] = [
  { peak: 14, dur: 0.92, delay: 0.0 },
  { peak: 26, dur: 0.78, delay: 0.08 },
  { peak: 22, dur: 1.05, delay: 0.04 },
  { peak: 28, dur: 0.82, delay: 0.12 },
  { peak: 16, dur: 0.95, delay: 0.02 },
];

export default function VoiceWave() {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center gap-1.5 h-8 w-full"
    >
      {BARS.map((b, i) => (
        <motion.span
          key={i}
          className="block w-[3px] rounded-full bg-accent shadow-[0_0_8px_rgba(224,139,122,0.35)]"
          initial={{ height: 5 }}
          animate={{ height: [5, b.peak, 5] }}
          transition={{
            duration: b.dur,
            repeat: Infinity,
            ease: "easeInOut",
            delay: b.delay,
          }}
        />
      ))}
    </div>
  );
}
