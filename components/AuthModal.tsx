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

  const handleDiscordLogin = async () => {
    if (!supabase) return;
    setLoading(true);
    setStatus("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
    }
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

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-900 px-2 text-slate-500 font-bold">
                      Or continue with
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleDiscordLogin}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-60 text-white font-black rounded-xl flex items-center justify-center gap-3 transition-all"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  Continue with Discord
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
