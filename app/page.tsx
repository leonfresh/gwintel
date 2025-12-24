"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browserClient";

export default function LoginPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

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

  const sendMagicLink = async () => {
    if (!supabase) return;
    setLoading(true);
    setStatus("");

    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    setLoading(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Magic link sent. Check your email.");
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

          <p className="text-sm text-white/70">
            We’ll email you a magic link to sign in.
          </p>

          <button
            onClick={sendMagicLink}
            disabled={loading || !email}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black rounded-xl"
          >
            Send magic link
          </button>
        </div>
      )}

      {status ? <p className="mt-6 text-slate-300">{status}</p> : null}

      <p className="mt-10 text-slate-500 text-sm">
        If you don’t receive emails, check Supabase Auth URL settings (Site URL
        + redirect allowlist) and email delivery.
      </p>
    </div>
  );
}
