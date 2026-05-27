"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Mail, Lock, X } from "lucide-react";

import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

function AuthInner() {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = search.get("redirect") || "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) {
      setError("Supabase is not configured");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.push(redirect);
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        if (data.session) {
          router.push(redirect);
        } else {
          setCheckEmail(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center px-5 py-12">
      {/* Floating close */}
      <Link
        href="/"
        aria-label="Close"
        className="fixed top-5 right-5 h-9 w-9 grid place-items-center rounded-lg text-ink-soft hover:text-ink hover:bg-surface-soft transition-colors z-50"
      >
        <X className="h-4 w-4" />
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <span className="font-serif text-2xl italic tracking-tight">
            TaskWave AI
          </span>
        </div>

        {checkEmail ? (
          <div className="rounded-2xl bg-surface border border-line p-8 shadow-sm text-center">
            <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-accent-soft mb-5">
              <Mail className="h-5 w-5 text-accent-deep" />
            </div>
            <h2 className="font-serif text-2xl mb-2">Check your inbox</h2>
            <p className="text-sm text-ink-soft mb-6">
              We sent a confirmation link to{" "}
              <span className="text-ink font-medium">{email}</span>. Click it
              and sign in.
            </p>
            <button
              onClick={() => {
                setCheckEmail(false);
                setMode("signin");
              }}
              className="text-sm text-accent-deep hover:underline"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-surface border border-line p-7 sm:p-8 shadow-sm">
            <h1 className="font-serif text-2xl mb-1">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-ink-soft mb-6">
              {mode === "signin"
                ? "Sign in to your voice task list."
                : "It takes about a minute."}
            </p>

            {error && (
              <div className="mb-5 rounded-md border border-danger/40 bg-danger/8 text-danger text-sm px-3 py-2.5">
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-[0.18em] text-ink-soft mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="w-full bg-bg border border-line rounded-lg pl-9 pr-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.18em] text-ink-soft mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete={
                      mode === "signin" ? "current-password" : "new-password"
                    }
                    placeholder="At least 8 characters"
                    className="w-full bg-bg border border-line rounded-lg pl-9 pr-10 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md text-ink-faint hover:text-ink"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-ink text-on-ink rounded-lg h-11 text-sm font-medium shadow-sm hover:shadow-md hover:bg-ink/92 disabled:opacity-60 transition-[background,box-shadow,transform] active:translate-y-[1px]"
              >
                {loading
                  ? mode === "signin"
                    ? "Signing in…"
                    : "Creating account…"
                  : mode === "signin"
                    ? "Sign in"
                    : "Create account"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-soft">
              {mode === "signin" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="text-accent-deep hover:underline font-medium"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have one?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="text-accent-deep hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <AuthInner />
    </Suspense>
  );
}
