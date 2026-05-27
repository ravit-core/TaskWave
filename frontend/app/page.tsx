"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Mic,
  Clock,
  Sparkles,
  ShieldCheck,
  ArrowLeftRight,
  Activity,
} from "lucide-react";
import { motion } from "framer-motion";

const POINTS = [
  {
    icon: Mic,
    title: "Voice CRUD",
    body: "Create, list, update, and delete tasks just by speaking. No edit buttons, no forms, no typing.",
  },
  {
    icon: ArrowLeftRight,
    title: "Drag by voice",
    body: "Move tasks between Today, Upcoming, and Done just by saying so. Say 'push to tomorrow' or 'mark it done' — the card slides across the board in real-time.",
  },
  {
    icon: Clock,
    title: "Natural time",
    body: "Understands 'today evening', 'tomorrow morning', 'in two hours', 'next Tuesday at 5'. Stored in your timezone.",
  },
  {
    icon: Activity,
    title: "Real-time barge-in",
    body: "Interrupt the assistant anytime. Powered by Gemini Live bidi audio — talk while it talks.",
  },
  {
    icon: ShieldCheck,
    title: "Confirm before delete",
    body: "Destructive actions are always confirmed verbally first. The agent never drops a task by surprise.",
  },
  {
    icon: Sparkles,
    title: "Context-aware",
    body: "Refer to 'the previous one', 'my evening workout', 'the LinkedIn task' — it follows the thread.",
  },
];

// Hero sound-wave backdrop: 32 vertical bars with warm-palette rotation,
// each animated on its own duration + delay. Heavy blur turns it into a
// soft moving haze rather than a literal equalizer. Sits behind the hero.
const HERO_WAVE_COLORS = ["bg-accent", "bg-accent-deep", "bg-ochre", "bg-sage"];

function HeroSoundWaves() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-14 md:top-20 inset-x-0 h-[58vh] -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 flex items-center justify-center gap-1.5 sm:gap-2 px-4 opacity-40 blur-3xl">
        {Array.from({ length: 32 }).map((_, i) => (
          <span
            key={i}
            className={`block w-2 sm:w-2.5 h-full rounded-full origin-center ${HERO_WAVE_COLORS[i % HERO_WAVE_COLORS.length]}`}
            style={{
              animation: `heroWave ${2.4 + (i % 6) * 0.42}s ease-in-out ${(i * 0.11) % 2.8}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-bg text-ink relative overflow-hidden">
      {/* Ambient color blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[40rem] h-[40rem] rounded-full bg-accent/15 blur-[140px]" />
        <div className="absolute top-1/3 -right-24 w-[36rem] h-[36rem] rounded-full bg-ochre/12 blur-[140px]" />
        <div className="absolute -bottom-40 left-1/4 w-[40rem] h-[40rem] rounded-full bg-sage/12 blur-[140px]" />
      </div>

      {/* Hero sound-wave backdrop — only the landing's first viewport */}
      <HeroSoundWaves />

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="mx-auto max-w-5xl px-5 md:px-8 py-6 flex items-center justify-between">
        <span className="font-serif text-xl italic tracking-tight">TaskWave AI</span>
        <Link
          href="/auth"
          className="text-sm text-ink-soft hover:text-ink transition-colors"
        >
          Sign in →
        </Link>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 md:px-8 pt-12 md:pt-20 pb-12 text-center md:text-left">
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-[11px] uppercase tracking-[0.22em] text-ink-soft mb-4"
        >
          TaskWave: Voice Controlled Task Manager
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="font-serif text-5xl md:text-7xl leading-[1.02] tracking-tight"
        >
          Your tasks,
          <br />
          <span className="italic text-accent-deep">spoken into being.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-6 text-base md:text-lg text-ink-soft max-w-xl leading-relaxed mx-auto md:mx-0"
        >
          A bidi voice assistant that listens, understands, and acts in
          real-time. Create, schedule, move, finish, and delete tasks — all
          through natural conversation.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.25 }}
          className="mt-10 flex items-center gap-4 justify-center md:justify-start"
        >
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 bg-ink text-on-ink rounded-lg h-12 px-7 text-sm font-medium shadow-sm hover:shadow-md hover:bg-ink/92 transition-[background,box-shadow,transform] active:translate-y-[1px]"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#board"
            className="text-sm text-ink-soft hover:text-ink transition-colors"
          >
            See the board ↓
          </a>
        </motion.div>
      </section>

      {/* ── The board (was 'How it sounds') ──────────────────────── */}
      <section
        id="board"
        className="mx-auto max-w-6xl px-5 md:px-8 py-16 border-t border-line"
      >
        <div className="text-center mb-10">
          <p className="text-[11px] uppercase tracking-[0.22em] text-ink-soft mb-3">
            How it works
          </p>
          <h2 className="font-serif text-3xl md:text-5xl leading-tight tracking-tight">
            A board that <span className="italic text-accent-deep">listens.</span>
          </h2>
          <p className="mt-4 text-sm md:text-base text-ink-soft max-w-2xl mx-auto leading-relaxed">
            Three kanban columns — Today, Upcoming, Done. The voice assistant
            sits in its own dark glass panel. Speak, and cards slide between
            columns in real-time.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl glass shadow-xl p-2 sm:p-3 overflow-hidden"
        >
          <Image
            src="/dashboard.png"
            alt="TaskWave dashboard — kanban board with voice assistant panel"
            width={2400}
            height={1500}
            priority
            sizes="(min-width: 1024px) 80vw, 95vw"
            className="w-full h-auto rounded-xl block"
          />
        </motion.div>
      </section>

      {/* ── What it does ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 md:px-8 py-16 border-t border-line">
        <div className="text-center md:text-left mb-10">
          <p className="text-[11px] uppercase tracking-[0.22em] text-ink-soft mb-3">
            What it does
          </p>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight tracking-tight">
            Built around the voice loop.
          </h2>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-7">
          {POINTS.map(({ icon: Icon, title, body }, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.32, delay: i * 0.04 }}
              className="flex flex-col gap-2"
            >
              <span className="grid place-items-center h-9 w-9 rounded-lg bg-surface-soft text-accent-deep shadow-xs">
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-semibold text-ink mt-1">{title}</h3>
              <p className="text-sm text-ink-soft leading-relaxed">{body}</p>
            </motion.li>
          ))}
        </ul>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 md:px-8 py-20 border-t border-line text-center">
        <h2 className="font-serif text-3xl md:text-4xl leading-tight tracking-tight">
          Stop typing your tasks.
          <br />
          <span className="italic text-accent-deep">Just say them.</span>
        </h2>
        <div className="mt-8">
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 bg-ink text-on-ink rounded-lg h-12 px-7 text-sm font-medium shadow-sm hover:shadow-md hover:bg-ink/92 transition-[background,box-shadow,transform] active:translate-y-[1px]"
          >
            Try TaskWave <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-10 text-[11px] uppercase tracking-[0.22em] text-ink-faint">
          Built with Gemini Live · Supabase · Next.js
        </p>
      </section>
    </main>
  );
}
