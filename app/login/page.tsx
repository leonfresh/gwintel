"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browserClient";

export default function LoginPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ingameName, setIngameName] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setStatus(
        "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
      );
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSignedInEmail(data.session?.user.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedInEmail(session?.user.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignUp = async () => {
    if (!supabase) return;
    if (!email || !password) {
      setStatus("Email and password are required.");
      return;
    }

    const desired = ingameName.trim();
    const desiredLower = desired.toLowerCase();
    if (desired) {
      const { data: existing, error: existsError } = await supabase
        .from("user_profiles")
        .select("user_id")
        .eq("username_lower", desiredLower)
        .maybeSingle();

      if (existsError) {
        setStatus(existsError.message);
        return;
      }

      if (existing) {
        setStatus("That in-game name is already taken.");
        return;
      }
    }

    setLoading(true);
    setStatus("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined, // Skip email confirmation
        data: {
          ingame_name: desired || null,
        },
      },
    });

    setLoading(false);
    if (error) {
      setStatus(error.message);
      return;
    }

    if (desired && data.user?.id) {
      const { error: upsertError } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: data.user.id,
            username: desired,
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        setStatus(upsertError.message);
        return;
      }
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
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-black tracking-tight text-white mb-6">
        Login
      </h1>

      {signedInEmail ? (
        <div className="space-y-4">
          <p className="text-slate-300">
            Signed in as <span className="font-semibold">{signedInEmail}</span>
          </p>
          <button
            onClick={signOut}
            disabled={loading}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white font-bold rounded-xl"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {isSignUp ? (
            <label className="block">
              <span className="text-slate-300 text-sm font-semibold">
                In-game name
              </span>
              <input
                value={ingameName}
                onChange={(e) => {
                  setIngameName(e.target.value);
                  if (status) setStatus("");
                }}
                className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                type="text"
                autoComplete="nickname"
                placeholder="Required (unique)"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="text-slate-300 text-sm font-semibold">Email</span>
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
      )}

      {status ? <p className="mt-6 text-slate-300">{status}</p> : null}
    </div>
  );
}
