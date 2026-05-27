"use client";

import { motion } from "framer-motion";
import { Circle, CheckCircle2, CircleSlash, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/tasks-api";

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  if (isTomorrow) return `Tomorrow · ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ` · ${time}`;
}

function isOverdue(iso: string | null, status: Task["status"]): boolean {
  if (!iso || status !== "pending") return false;
  return new Date(iso).getTime() < Date.now();
}

function StatusGlyph({ status, overdue }: { status: Task["status"]; overdue: boolean }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-sage" />;
  if (status === "cancelled") return <CircleSlash className="h-4 w-4 text-ink-faint" />;
  if (overdue) return <AlertCircle className="h-4 w-4 text-accent-deep" />;
  return <Circle className="h-4 w-4 text-ink-faint" />;
}

export default function TaskCard({ task }: { task: Task }) {
  const time = formatTime(task.scheduled_at);
  const overdue = isOverdue(task.scheduled_at, task.status);

  return (
    <motion.li
      layoutId={`task-${task.id}`}
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{
        layout: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.25 },
        y: { duration: 0.25 },
        scale: { duration: 0.25 },
      }}
      className={cn(
        "group relative rounded-lg bg-surface border border-line",
        "px-3.5 py-3 shadow-xs hover:shadow-sm hover:-translate-y-[1px]",
        "transition-[transform,box-shadow,border-color]",
        task.status === "done" && "bg-surface-soft border-line-soft shadow-none hover:shadow-none",
        overdue && "border-accent/50"
      )}
    >
      {/* Left accent stripe for overdue */}
      {overdue && (
        <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-accent-deep" />
      )}

      <div className="flex items-start gap-2.5">
        <span className="mt-[2px] shrink-0">
          <StatusGlyph status={task.status} overdue={overdue} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm text-ink leading-snug break-words",
              task.status === "done" && "line-through text-ink-soft"
            )}
          >
            {task.title}
          </p>
          {task.notes && (
            <p className="text-xs text-ink-soft mt-1 leading-snug break-words line-clamp-2">
              {task.notes}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-soft">
            {time ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  overdue && "text-accent-deep font-medium"
                )}
              >
                <Clock className="h-3 w-3" />
                {time}
              </span>
            ) : task.status !== "done" ? (
              <span className="italic text-ink-faint">No time set</span>
            ) : null}
          </div>
        </div>
      </div>
    </motion.li>
  );
}
