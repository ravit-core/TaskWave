"use client";

import { cn } from "@/lib/utils";
import type { AgentState } from "@/lib/voice-client";

const LABELS: Record<AgentState, string> = {
  idle: "Tap the mic to start",
  connecting: "Connecting…",
  ready: "Ready",
  listening: "Listening",
  speaking: "Speaking",
  error: "Something went wrong",
  disconnected: "Tap the mic to start",
};

const DOT_COLOR: Record<AgentState, string> = {
  idle: "bg-ink-faint",
  connecting: "bg-ochre animate-pulse",
  ready: "bg-sage",
  listening: "bg-accent animate-pulse",
  speaking: "bg-sage",
  error: "bg-danger",
  disconnected: "bg-ink-faint",
};

export default function AgentStatus({ state }: { state: AgentState }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full", DOT_COLOR[state])}
      />
      <p className="text-[11px] uppercase tracking-[0.22em] text-ink-soft">
        {LABELS[state]}
      </p>
    </div>
  );
}
