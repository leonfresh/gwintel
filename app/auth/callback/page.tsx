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

    const handleAuthCallback = async () => {
      try {
        // Let Supabase handle the OAuth callback automatically
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth error:", error);
          setStatus(`Error: ${error.message}`);
          return;
        }

        if (data.session) {
          setStatus("Signed in successfully! Redirecting...");
          setTimeout(() => router.replace("/"), 1000);
        } else {
          setStatus("No session found. Please try signing in again.");
          setTimeout(() => router.replace("/"), 2000);
        }
      } catch (e) {
        console.error("Callback error:", e);
        setStatus(
          `Failed to finalize auth: ${
            e instanceof Error ? e.message : "Unknown error"
          }`
        );
      }
    };

    handleAuthCallback();
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
