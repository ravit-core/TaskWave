"use client";

import { Mic, Loader2, MicOff, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AgentState } from "@/lib/voice-client";

type Props = {
  state: AgentState;
  onPress: () => void;
};

const ICON_MAP: Record<AgentState, React.ReactNode> = {
  idle: <Mic className="h-9 w-9" />,
  connecting: <Loader2 className="h-9 w-9 animate-spin" />,
  ready: <Mic className="h-9 w-9" />,
  listening: <Mic className="h-9 w-9" />,
  speaking: <Mic className="h-9 w-9" />,
  error: <AlertCircle className="h-9 w-9" />,
  disconnected: <MicOff className="h-9 w-9" />,
};

const FILL_MAP: Record<AgentState, string> = {
  idle: "bg-ink text-on-ink",
  connecting: "bg-ink text-on-ink",
  ready: "bg-ink text-on-ink",
  listening: "bg-accent text-on-ink",
  speaking: "bg-sage text-on-ink",
  error: "bg-danger text-on-ink",
  disconnected: "bg-surface-soft text-ink-soft border border-line",
};

export default function MicButton({ state, onPress }: Props) {
  const isPulsing = state === "listening";
  const isLive = state === "listening" || state === "speaking";
  const isIdle = state === "idle" || state === "ready" || state === "disconnected";

  return (
    <div className="relative grid place-items-center p-4">
      {/* Outer static halo — makes the button look like a clear tap target */}
      <span
        aria-hidden
        className={cn(
          "absolute h-36 w-36 rounded-full pointer-events-none",
          "bg-ink/5 ring-1 ring-ink/10",
          "transition-[background-color,box-shadow] duration-300",
          "group-hover/mic:bg-ink/10"
        )}
      />

      {/* Gentle idle pulse — invites the user to tap */}
      <AnimatePresence>
        {isIdle && (
          <motion.span
            key="idle-pulse"
            aria-hidden
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0.25, 0.05, 0.25], scale: [1, 1.15, 1] }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute h-32 w-32 rounded-full bg-ink/15 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <button
        onClick={onPress}
        className={cn(
          "group/mic relative h-28 w-28 rounded-full grid place-items-center",
          "shadow-lg hover:shadow-xl hover:scale-[1.04]",
          "ring-2 ring-ink/10 hover:ring-ink/25",
          "transition-[box-shadow,transform,background-color] duration-300",
          "active:scale-[0.97]",
          "cursor-pointer",
          FILL_MAP[state]
        )}
        aria-label={
          isLive ? "Stop talking to TaskWave" : "Start talking to TaskWave"
        }
      >
        {/* Breathing ring — only when listening */}
        <AnimatePresence>
          {isPulsing && (
            <motion.span
              key="ring"
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0, 0.45, 0], scale: [1, 1.35, 1.55] }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: [0.65, 0, 0.35, 1],
              }}
              className="absolute inset-0 rounded-full bg-accent/35"
            />
          )}
        </AnimatePresence>

        <span className="relative z-10">{ICON_MAP[state]}</span>
      </button>

      {/* Action label below — makes the affordance unmistakable */}
      <span
        className={cn(
          "absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full",
          "text-[11px] uppercase tracking-[0.18em] text-ink-soft",
          "select-none pointer-events-none whitespace-nowrap"
        )}
      >
        {isLive ? "Tap to stop" : "Tap to talk"}
      </span>
    </div>
  );
}
