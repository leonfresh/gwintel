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
  const [password, setPassword] = useState("");
  const [ingameName, setIngameName] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

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

  const handleSignUp = async () => {
    if (!supabase) {
      setStatus(
        "Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
      );
      return;
    }
    if (!email || !password) {
      setStatus("Email and password are required.");
      return;
    }
    setLoading(true);
    setStatus("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          ingame_name: ingameName.trim() || null,
        },
        emailRedirectTo: undefined, // Skip email confirmation
      },
    });

    setLoading(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Account created! You're now signed in.");
  };

  const handleSignIn = async () => {
    if (!supabase) return;
    if (!email || !password) {
      setStatus("Email and password are required.");
      return;
    }
    setLoading(true);
    setStatus("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Signed in successfully!");
    setTimeout(() => onClose(), 1000);
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
              {user
                ? "You are signed in."
                : isSignUp
                ? "Create a new account"
                : "Sign in to your account"}
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
              {isSignUp && (
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
              )}

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

              <label className="block">
                <span className="text-slate-300 text-sm font-semibold">
                  Password
                </span>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                />
              </label>

              <div className="space-y-3">
                <button
                  onClick={isSignUp ? handleSignUp : handleSignIn}
                  disabled={loading || !email || !password}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black rounded-xl"
                >
                  {isSignUp ? "Sign up" : "Sign in"}
                </button>
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setStatus("");
                  }}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white font-bold rounded-xl border border-slate-700"
                >
                  {isSignUp
                    ? "Already have an account? Sign in"
                    : "Need an account? Sign up"}
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
