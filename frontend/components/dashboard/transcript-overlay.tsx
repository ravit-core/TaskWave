"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Line = {
  id: number;
  role: "user" | "agent";
  text: string;
};

export default function TranscriptOverlay({ lines }: { lines: Line[] }) {
  const tail = lines.slice(-6);

  if (tail.length === 0) {
    return (
      <p className="text-xs text-ink-faint italic text-center py-2">
        Tap the mic and speak.
      </p>
    );
  }

  return (
    <div className="w-full space-y-1.5 max-h-[18rem] overflow-y-auto">
      <AnimatePresence initial={false}>
        {tail.map((l) => (
          <motion.div
            key={l.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "rounded-lg px-3 py-2 text-xs leading-relaxed",
              l.role === "user"
                ? "bg-surface-soft text-ink"
                : "bg-accent-soft/40 text-ink-soft font-serif italic"
            )}
          >
            {l.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
