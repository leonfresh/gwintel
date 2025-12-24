"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browserClient";

interface Props {
  open: boolean;
  onComplete: () => void;
}

export default function UsernameSetupModal({ open, onComplete }: Props) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    const desired = username.trim();
    const desiredLower = desired.toLowerCase();

    setLoading(true);
    setError("");

    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Supabase client not available");
      setLoading(false);
      return;
    }

    try {
      const { data: userData } = await client.auth.getUser();
      if (!userData.user) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      // Check username availability (case-insensitive)
      const { data: existingProfile, error: existsError } = await client
        .from("user_profiles")
        .select("user_id")
        .eq("username_lower", desiredLower)
        .maybeSingle();

      if (existsError) {
        setError(existsError.message);
        setLoading(false);
        return;
      }

      if (existingProfile && existingProfile.user_id !== userData.user.id) {
        setError("That username is already taken.");
        setLoading(false);
        return;
      }

      const { error: updateError } = await client.auth.updateUser({
        data: {
          ingame_name: desired,
        },
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      // Register/refresh username in public table
      const { error: upsertError } = await client.from("user_profiles").upsert(
        {
          user_id: userData.user.id,
          username: desired,
        },
        { onConflict: "user_id" }
      );

      if (upsertError) {
        // Could be a uniqueness violation on username_lower
        setError(upsertError.message);
        setLoading(false);
        return;
      }

      onComplete();
    } catch {
      setError("Failed to update username");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative mx-auto mt-32 w-[min(480px,92vw)] rounded-3xl border-2 border-blue-500/30 bg-slate-900 bg-grain shadow-2xl">
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white mb-2">
              Welcome to Rebirth GW Intel!
            </h2>
            <p className="text-slate-400 text-sm">
              Set your in-game name so other players can identify your reports
            </p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-slate-300 text-sm font-semibold mb-2 block">
                In-game Name
              </span>
              <input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 focus:border-blue-500 text-white text-lg font-bold transition-colors"
                type="text"
                placeholder="Your Seven Knights name"
                autoFocus
                disabled={loading}
              />
            </label>

            {error && (
              <p className="text-rose-400 text-sm font-semibold">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !username.trim()}
              className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all text-lg uppercase tracking-wider"
            >
              {loading ? "Saving..." : "Complete Setup"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
