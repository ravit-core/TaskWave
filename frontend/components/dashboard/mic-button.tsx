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

  return (
    <button
      onClick={onPress}
      className={cn(
        "relative h-28 w-28 rounded-full grid place-items-center",
        "shadow-lg hover:shadow-xl",
        "transition-[box-shadow,transform] duration-300",
        "active:scale-[0.97]",
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
  );
}
