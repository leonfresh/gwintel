"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase/browserClient";

export default function AuthModal({
  open,
  reason,
  onClose,
}: {
  open: boolean;
  reason?: "post" | "vote" | "generic";
  onClose: () => void;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [ingameName, setIngameName] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus("");
    setIngameName("");

    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [open, supabase]);

  if (!open) return null;

  const title =
    reason === "post"
      ? "Sign in to post"
      : reason === "vote"
      ? "Sign in to vote"
      : "Sign in";

  const close = () => {
    if (loading) return;
    onClose();
  };

  const sendMagicLink = async () => {
    if (!supabase) {
      setStatus(
        "Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
      );
      return;
    }
    setLoading(true);
    setStatus("");

    const emailRedirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        data: {
          ingame_name: ingameName.trim() || null,
        },
      },
    });
    setLoading(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus(
      "Magic link sent. Open your email and click the link to finish signing in."
    );
  };

  const resendMagicLink = async () => {
    if (!supabase) return;
    if (!email) {
      setStatus("Enter your email first, then click resend.");
      return;
    }
    setLoading(true);
    setStatus("");

    const emailRedirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        data: {
          ingame_name: ingameName.trim() || null,
        },
      },
    });

    setLoading(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Magic link resent.");
  };

  const signOut = async () => {
    if (!supabase) return;
    setLoading(true);
    setStatus("");
    const { error } = await supabase.auth.signOut();
    setLoading(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Signed out.");
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-black/70"
      />

      <div className="relative mx-auto mt-24 w-[min(520px,92vw)] rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">{title}</h2>
            <p className="text-slate-400 text-sm mt-1">
              {user ? "You are signed in." : "We’ll email you a magic link."}
            </p>
          </div>
          <button
            onClick={close}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {!user ? (
          <div className="p-6">
            <div className="space-y-4">
              <label className="block">
                <span className="text-slate-300 text-sm font-semibold">
                  In-game name
                </span>
                <input
                  value={ingameName}
                  onChange={(e) => setIngameName(e.target.value)}
                  className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  type="text"
                  autoComplete="nickname"
                  placeholder="Optional (recommended)"
                />
              </label>

              <label className="block">
                <span className="text-slate-300 text-sm font-semibold">
                  Email
                </span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  type="email"
                  autoComplete="email"
                />
              </label>

              <div className="space-y-3">
                <button
                  onClick={sendMagicLink}
                  disabled={loading || !email}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black rounded-xl"
                >
                  Send magic link
                </button>
                <button
                  onClick={resendMagicLink}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white font-bold rounded-xl border border-slate-700"
                >
                  Resend magic link
                </button>
              </div>
            </div>

            {status ? (
              <p className="mt-5 text-slate-300 text-sm">{status}</p>
            ) : null}
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <p className="text-slate-300 text-sm">
              Signed in as <span className="font-semibold">{user.email}</span>
            </p>

            <button
              onClick={signOut}
              disabled={loading}
              className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white font-bold rounded-xl"
            >
              Sign out
            </button>

            {status ? <p className="text-slate-300 text-sm">{status}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
