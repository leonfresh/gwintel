"use client";

import { createClient } from "@supabase/supabase-js";

import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let cached: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  if (cached) return cached;
  cached = createClient(supabaseUrl, supabaseKey);
  return cached;
}

export const supabase = getSupabaseBrowserClient();
