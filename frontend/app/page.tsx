"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Mic,
  Clock,
  Sparkles,
  ShieldCheck,
  ArrowLeftRight,
  Activity,
  Waves,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ─────────────────────────────────────────────────────────────────
   Conversation samples — used by hero demo + "How it sounds" cycler
   ───────────────────────────────────────────────────────────────── */
const CONVERSATIONS = [
  {
    user: "Create a task for syncing with the PM at 10 AM.",
    agent: "Added “Sync with PM” for today at 10:00 AM.",
    tool: "create_task",
  },
  {
    user: "Move my evening workout to 7.",
    agent: "Moved “Workout” to today at 7:00 PM.",
    tool: "update_task",
  },
  {
    user: "What's coming up tomorrow morning?",
    agent: "Three tasks — gym at 7, standup at 9, LinkedIn post at 11.",
    tool: "list_tasks",
  },
  {
    user: "Delete the 9:15 task.",
    agent: "You have a 9:15 and a 9:30. Delete the 9:15 — is that right?",
    tool: "list_tasks",
  },
];

const FEATURES = [
  {
    icon: Mic,
    title: "Voice CRUD",
    body: "Create, list, update, and delete tasks just by speaking. No forms. No edit buttons.",
  },
  {
    icon: ArrowLeftRight,
    title: "Drag by voice",
    body: "Say “push to tomorrow” or “mark it done” — cards slide between columns in real time.",
  },
  {
    icon: Clock,
    title: "Natural time",
    body: "“Today evening”, “tomorrow morning”, “in two hours” — parsed in your timezone.",
  },
  {
    icon: Activity,
    title: "Real-time barge-in",
    body: "Interrupt mid-sentence. Gemini Live bidi audio listens while it talks.",
  },
  {
    icon: ShieldCheck,
    title: "Confirm before delete",
    body: "Destructive actions are confirmed verbally first. Nothing disappears by surprise.",
  },
  {
    icon: Sparkles,
    title: "Context-aware",
    body: "“The previous one”, “my evening workout”, “the LinkedIn task” — it follows the thread.",
  },
];

const STATS = [
  { value: "~300ms", label: "Voice round-trip" },
  { value: "24 kHz", label: "Native TTS audio" },
  { value: "16 kHz", label: "PCM mic capture" },
  { value: "5", label: "Function tools" },
];

/* ─────────────────────────────────────────────────────────────────
   Ambient hero waveform — soft, blurred, behind the headline.
   Kept from the original but slightly more restrained.
   ───────────────────────────────────────────────────────────────── */
const HERO_WAVE_COLORS = ["bg-accent", "bg-accent-deep", "bg-ochre", "bg-sage"];

function HeroSoundWaves() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-14 md:top-20 inset-x-0 h-[62vh] -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 flex items-center justify-center gap-1.5 sm:gap-2 px-4 opacity-35 blur-3xl">
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

/* ─────────────────────────────────────────────────────────────────
   LiveWave — compact 14-bar animated waveform for the demo card.
   ───────────────────────────────────────────────────────────────── */
function LiveWave({ active = true }: { active?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="block w-[3px] rounded-full bg-accent/80"
          style={{
            height: active ? undefined : "20%",
            animation: active
              ? `heroWave ${0.9 + (i % 5) * 0.22}s ease-in-out ${(i * 0.07) % 1.4}s infinite`
              : undefined,
            transformOrigin: "center",
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Hero demo card — a faux "live voice session" that cycles through
   a few example transcripts. Sells the product better than the
   dashboard screenshot alone.
   ───────────────────────────────────────────────────────────────── */
function HeroDemoCard() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % CONVERSATIONS.length), 4200);
    return () => clearInterval(t);
  }, []);
  const c = CONVERSATIONS[i];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-sm mx-auto"
    >
      {/* Soft accent halo behind the card */}
      <div
        aria-hidden
        className="absolute -inset-6 bg-accent/15 blur-3xl rounded-[2rem] -z-10"
      />

      <div className="rounded-2xl glass shadow-xl overflow-hidden">
        {/* Card header — looks like an active live session */}
        <div className="px-4 py-3 border-b border-line/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-sage opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sage" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              Live session
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            Gemini Live
          </span>
        </div>

        {/* Mic + waveform */}
        <div className="px-5 py-6 flex flex-col items-center gap-3">
          <div className="relative h-16 w-16 rounded-full bg-ink text-on-ink grid place-items-center shadow-lg">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-accent/25"
              style={{ animation: "breathe var(--dur-breath) var(--ease-in-out-soft) infinite" }}
            />
            <Mic className="h-6 w-6 relative z-10" />
          </div>
          <LiveWave />
        </div>

        {/* Transcript bubbles */}
        <div className="px-5 pb-5 space-y-2.5 min-h-[12.5rem]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`u-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35 }}
              className="flex justify-end"
            >
              <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-ink text-on-ink text-sm px-3.5 py-2.5 leading-snug shadow-sm">
                {c.user}
              </div>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`a-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, delay: 0.18 }}
              className="flex justify-start"
            >
              <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-surface text-ink text-sm px-3.5 py-2.5 leading-snug shadow-sm border border-line/60">
                {c.agent}
              </div>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`t-${i}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.32 }}
              className="flex items-center gap-1.5 pt-1 pl-1"
            >
              <CheckCircle2 className="h-3 w-3 text-sage" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                tool · {c.tool}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-bg text-ink relative overflow-hidden">
      {/* Ambient color blobs — fixed, behind everything */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[40rem] h-[40rem] rounded-full bg-accent/15 blur-[140px]" />
        <div className="absolute top-1/3 -right-24 w-[36rem] h-[36rem] rounded-full bg-ochre/12 blur-[140px]" />
        <div className="absolute -bottom-40 left-1/4 w-[40rem] h-[40rem] rounded-full bg-sage/12 blur-[140px]" />
      </div>

      {/* Hero waveform backdrop */}
      <HeroSoundWaves />

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-bg/70 border-b border-line/40">
        <div className="mx-auto max-w-6xl px-5 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-serif text-xl italic tracking-tight">
              TaskWave AI
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sage/10 border border-sage/20">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                Live
              </span>
            </span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="#features"
              className="hidden md:inline text-sm text-ink-soft hover:text-ink transition-colors"
            >
              Features
            </a>
            <a
              href="#sounds"
              className="hidden md:inline text-sm text-ink-soft hover:text-ink transition-colors"
            >
              How it sounds
            </a>
            <Link
              href="/auth"
              className="inline-flex items-center gap-1.5 bg-ink text-on-ink rounded-lg h-9 px-4 text-sm font-medium shadow-sm hover:shadow-md hover:bg-ink/92"
            >
              Sign in <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 md:px-8 pt-14 md:pt-24 pb-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
        {/* Left — copy */}
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-line/60 mb-6"
          >
            <Waves className="h-3.5 w-3.5 text-accent-deep" />
            <span className="text-[11px] uppercase tracking-[0.22em] text-ink-soft">
              Voice-first task agent
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
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
            className="mt-6 text-base md:text-lg text-ink-soft max-w-xl leading-relaxed mx-auto lg:mx-0"
          >
            A real-time voice assistant that listens, understands, and acts.
            Create, schedule, move, finish, and delete tasks — all through
            natural conversation.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.25 }}
            className="mt-9 flex items-center gap-4 justify-center lg:justify-start flex-wrap"
          >
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 bg-ink text-on-ink rounded-lg h-12 px-7 text-sm font-medium shadow-md hover:shadow-lg hover:bg-ink/92 active:translate-y-[1px]"
            >
              Start talking <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#sounds"
              className="inline-flex items-center gap-2 h-12 px-5 text-sm text-ink-soft hover:text-ink rounded-lg border border-line hover:border-line-strong"
            >
              Hear a session ↓
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 flex items-center gap-5 justify-center lg:justify-start text-[11px] uppercase tracking-[0.18em] text-ink-faint"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-sage" /> No typing
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-sage" /> Barge-in
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-sage" /> Real-time
            </span>
          </motion.div>
        </div>

        {/* Right — live demo card */}
        <div className="relative">
          <HeroDemoCard />
        </div>
      </section>

      {/* ── How it sounds ───────────────────────────────────────── */}
      <section
        id="sounds"
        className="mx-auto max-w-5xl px-5 md:px-8 py-20 border-t border-line"
      >
        <div className="text-center mb-12">
          <p className="text-[11px] uppercase tracking-[0.22em] text-ink-soft mb-3">
            How it sounds
          </p>
          <h2 className="font-serif text-3xl md:text-5xl leading-tight tracking-tight">
            Natural conversation,
            <br />
            <span className="italic text-accent-deep">live function calls.</span>
          </h2>
          <p className="mt-5 text-sm md:text-base text-ink-soft max-w-2xl mx-auto leading-relaxed">
            Every sentence becomes a tool call. The agent confirms what it
            heard, asks one question if it's unsure, and updates your board
            without you touching anything.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {CONVERSATIONS.map((c, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: idx * 0.06 }}
              className="rounded-2xl glass p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-end mb-2">
                <div className="max-w-[90%] rounded-2xl rounded-tr-md bg-ink text-on-ink text-sm px-3.5 py-2.5 leading-snug">
                  {c.user}
                </div>
              </div>
              <div className="flex justify-start mb-3">
                <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-surface text-ink text-sm px-3.5 py-2.5 leading-snug border border-line/60">
                  {c.agent}
                </div>
              </div>
              <div className="flex items-center gap-1.5 pl-1">
                <CheckCircle2 className="h-3 w-3 text-sage" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                  tool · {c.tool}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── The board ───────────────────────────────────────────── */}
      <section
        id="board"
        className="mx-auto max-w-6xl px-5 md:px-8 py-20 border-t border-line"
      >
        <div className="text-center mb-12">
          <p className="text-[11px] uppercase tracking-[0.22em] text-ink-soft mb-3">
            See the board
          </p>
          <h2 className="font-serif text-3xl md:text-5xl leading-tight tracking-tight">
            A board that <span className="italic text-accent-deep">listens.</span>
          </h2>
          <p className="mt-5 text-sm md:text-base text-ink-soft max-w-2xl mx-auto leading-relaxed">
            Three kanban columns — Today, Upcoming, Done. The voice panel sits
            on the right in its own dark glass. Speak, and cards slide between
            columns in real time.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          {/* Halo */}
          <div
            aria-hidden
            className="absolute -inset-8 bg-accent/10 blur-3xl rounded-[3rem] -z-10"
          />
          <div className="relative rounded-2xl glass shadow-xl p-2 sm:p-3 overflow-hidden">
            <Image
              src="/dashboard.png"
              alt="TaskWave AI dashboard — kanban board with voice assistant panel"
              width={2400}
              height={1500}
              priority
              sizes="(min-width: 1024px) 80vw, 95vw"
              className="w-full h-auto rounded-xl block"
            />
          </div>
        </motion.div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section
        id="features"
        className="mx-auto max-w-6xl px-5 md:px-8 py-20 border-t border-line"
      >
        <div className="text-center mb-14">
          <p className="text-[11px] uppercase tracking-[0.22em] text-ink-soft mb-3">
            What it does
          </p>
          <h2 className="font-serif text-3xl md:text-5xl leading-tight tracking-tight">
            Built around the voice loop.
          </h2>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className="group relative rounded-2xl glass p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow]"
            >
              <span className="inline-grid place-items-center h-10 w-10 rounded-xl bg-accent-soft text-accent-deep shadow-xs mb-4">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
              <h3 className="text-base font-semibold text-ink mb-1.5">{title}</h3>
              <p className="text-sm text-ink-soft leading-relaxed">{body}</p>
            </motion.li>
          ))}
        </ul>
      </section>

      {/* ── Stats / credibility strip ───────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 md:px-8 py-14 border-t border-line">
        <div className="rounded-2xl glass-dark shadow-lg overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[color:var(--glass-dark-border)] divide-y md:divide-y-0">
            {STATS.map((s, i) => (
              <div
                key={i}
                className="px-6 py-8 text-center flex flex-col items-center gap-1.5"
              >
                <span className="font-serif text-3xl md:text-4xl tracking-tight text-on-ink">
                  {s.value}
                </span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 md:px-8 py-24 border-t border-line text-center relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-10 h-40 bg-accent/10 blur-3xl -z-10"
        />
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
          Stop typing your tasks.
          <br />
          <span className="italic text-accent-deep">Just say them.</span>
        </h2>
        <p className="mt-5 text-sm md:text-base text-ink-soft max-w-lg mx-auto leading-relaxed">
          One mic button. Real conversation. Your kanban board does the rest.
        </p>
        <div className="mt-10 flex items-center gap-4 justify-center flex-wrap">
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 bg-ink text-on-ink rounded-lg h-12 px-7 text-sm font-medium shadow-md hover:shadow-lg hover:bg-ink/92 active:translate-y-[1px]"
          >
            Try TaskWave AI <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 h-12 px-5 text-sm text-ink-soft hover:text-ink rounded-lg border border-line hover:border-line-strong"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-12 text-[11px] uppercase tracking-[0.22em] text-ink-faint">
          Built with Gemini Live · Supabase · Next.js
        </p>
      </section>
    </main>
  );
}
