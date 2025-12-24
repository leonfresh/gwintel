"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browserClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [status, setStatus] = useState("Finalizing sign-in...");

  useEffect(() => {
    if (!supabase) {
      setStatus("Missing Supabase env vars.");
      return;
    }

    (async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );
        if (error) {
          setStatus(error.message);
          return;
        }
        setStatus("Signed in. Redirecting...");
        router.replace("/");
      } catch (e) {
        setStatus("Failed to finalize auth.");
      }
    })();
  }, [router, supabase]);

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-black tracking-tight text-white mb-4">
        Auth
      </h1>
      <p className="text-slate-300">{status}</p>
    </div>
  );
}
