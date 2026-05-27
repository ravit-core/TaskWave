"use client";

import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/tasks-api";
import TaskCard from "./task-card";

type Props = {
  title: string;
  icon: React.ReactNode;
  hint?: string;
  tasks: Task[];
  emptyLabel?: string;
  accent?: "default" | "muted";
};

export default function BoardColumn({
  title,
  icon,
  hint,
  tasks,
  emptyLabel = "Nothing here yet.",
  accent = "default",
}: Props) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl glass-soft shadow-sm overflow-hidden",
        "p-3 sm:p-3.5",
        "min-h-[18rem] lg:min-h-0 lg:h-full"
      )}
    >
      {/* ── Column header ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-1.5 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "h-6 w-6 grid place-items-center rounded-md shrink-0 shadow-xs",
              accent === "muted"
                ? "bg-surface text-ink-soft"
                : "bg-surface text-accent-deep"
            )}
          >
            {icon}
          </span>
          <h3 className="text-[13px] font-semibold tracking-tight text-ink truncate">
            {title}
          </h3>
        </div>
        <span
          className={cn(
            "text-[11px] tabular-nums font-semibold px-1.5 py-0.5 rounded-md",
            tasks.length === 0
              ? "text-ink-faint"
              : accent === "muted"
                ? "bg-surface text-ink-soft"
                : "bg-accent-soft text-accent-deep"
          )}
        >
          {tasks.length}
        </span>
      </header>

      {/* Subtle divider under header — gives it a 'kanban' anchor */}
      <div
        className={cn(
          "mx-1.5 mb-3 h-px",
          accent === "muted" ? "bg-line-soft" : "bg-line"
        )}
      />

      {hint && (
        <p className="px-1.5 -mt-2 mb-3 text-[10px] text-ink-faint">{hint}</p>
      )}

      {/* ── Cards ── flex-1 + overflow-y-auto so a long list scrolls
           inside the column instead of pushing the page off-viewport.
           overscroll-contain stops scroll-chaining onto the page. */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 -mr-1">
        {tasks.length === 0 ? (
          <div className="h-full min-h-[7rem] rounded-lg border border-dashed border-line/80 grid place-items-center px-4">
            <p className="text-xs text-ink-faint italic text-center">
              {emptyLabel}
            </p>
          </div>
        ) : (
          <ul className="space-y-2 pb-1">
            <AnimatePresence initial={false}>
              {tasks.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}
