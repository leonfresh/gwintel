"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import type { Hero, LogType, SkillQueueItem } from "../../../types";
import { HERO_DATABASE } from "../../../constants";
import HeroAvatar from "../../../components/HeroAvatar";
import HeroHoverCard from "../../../components/HeroHoverCard";
import { HeroHoverProvider } from "../../../components/HeroHoverProvider";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browserClient";

type DbStrategyLogRow = {
  id: string;
  enemy_team: string[];
  counter_team: string[];
  skill_queue: SkillQueueItem[] | unknown | null;
  type: LogType;
  notes: string;
  votes: number;
  author_id: string;
  author_email: string | null;
  author_name: string | null;
  created_at: string;
};

type Team = {
  ids: string[];
  key: string;
};

type DatasetEntry = {
  enemy: Team;
  bestCounter: { team: Team; weight: number };
};

type Question = {
  enemy: Team;
  correct: Team;
  options: Team[];
};

function normalizeTeam(ids: string[]): Team {
  const cleaned = ids.filter(Boolean);
  const sorted = [...cleaned].sort();
  return { ids: sorted, key: sorted.join(",") };
}

function uniqByKey<T extends { key: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of items) {
    if (seen.has(x.key)) continue;
    seen.add(x.key);
    out.push(x);
  }
  return out;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clampNonNegative(n: number) {
  return Math.max(0, Math.floor(n));
}

function TeamStrip({
  team,
  heroById,
  label,
}: {
  team: Team;
  heroById: Map<string, Hero>;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label ? (
        <div className="text-[10px] uppercase tracking-[0.35em] font-black text-slate-500 mr-1">
          {label}
        </div>
      ) : null}
      {team.ids.map((id) => {
        const hero = heroById.get(id);
        if (!hero) return null;
        return (
          <HeroHoverCard key={id} hero={hero}>
            <span className="inline-flex">
              <HeroAvatar hero={hero} size="md" showTier />
            </span>
          </HeroHoverCard>
        );
      })}
    </div>
  );
}

function buildDataset(rows: DbStrategyLogRow[]): DatasetEntry[] {
  const byEnemy = new Map<
    string,
    {
      enemy: Team;
      counters: Map<string, { team: Team; weight: number }>;
    }
  >();

  for (const row of rows) {
    if (row.type !== "success") continue;
    if (!Array.isArray(row.enemy_team) || row.enemy_team.length === 0) continue;
    if (!Array.isArray(row.counter_team) || row.counter_team.length === 0)
      continue;

    const enemy = normalizeTeam(row.enemy_team);
    const counter = normalizeTeam(row.counter_team);

    // Weight uses vote totals but never negative.
    const weight = clampNonNegative(row.votes) + 1;

    let entry = byEnemy.get(enemy.key);
    if (!entry) {
      entry = { enemy, counters: new Map() };
      byEnemy.set(enemy.key, entry);
    }

    const current = entry.counters.get(counter.key);
    if (!current) {
      entry.counters.set(counter.key, { team: counter, weight });
    } else {
      entry.counters.set(counter.key, {
        team: current.team,
        weight: current.weight + weight,
      });
    }
  }

  const dataset: DatasetEntry[] = [];
  for (const entry of byEnemy.values()) {
    const best = [...entry.counters.values()].sort(
      (a, b) => b.weight - a.weight
    )[0];
    if (!best) continue;
    dataset.push({ enemy: entry.enemy, bestCounter: best });
  }

  return dataset.sort((a, b) => b.bestCounter.weight - a.bestCounter.weight);
}

function makeQuestion(dataset: DatasetEntry[]): Question | null {
  if (dataset.length === 0) return null;
  const pick = dataset[Math.floor(Math.random() * dataset.length)];
  const enemy = pick.enemy;
  const correct = pick.bestCounter.team;

  const distractors: Team[] = [];
  const pool = shuffle(dataset)
    .filter((x) => x.enemy.key !== enemy.key)
    .map((x) => x.bestCounter.team);

  for (const t of pool) {
    if (t.key === correct.key) continue;
    distractors.push(t);
    if (distractors.length >= 3) break;
  }

  const options = shuffle(uniqByKey([correct, ...distractors]));
  return { enemy, correct, options };
}

export default function CounterQuizClient() {
  const heroById = useMemo(() => {
    const m = new Map<string, Hero>();
    for (const h of HERO_DATABASE) m.set(h.id, h);
    return m;
  }, []);

  const [mode, setMode] = useState<"quiz" | "flashcards">("quiz");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<DatasetEntry[]>([]);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answered, setAnswered] = useState<{
    pickedKey: string | null;
    correct: boolean;
  } | null>(null);
  const [reveal, setReveal] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const client = getSupabaseBrowserClient();
        if (!client) {
          throw new Error(
            "Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL / key)."
          );
        }

        const { data, error: supaError } = await client
          .from("strategy_logs")
          .select("id,enemy_team,counter_team,type,votes,created_at")
          .order("created_at", { ascending: false });

        if (cancelled) return;
        if (supaError) throw supaError;

        const rows = (data ?? []) as DbStrategyLogRow[];
        const ds = buildDataset(rows);
        setDataset(ds);
        setQuestion(makeQuestion(ds));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load data.";
        setError(msg);
        setDataset([]);
        setQuestion(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const next = () => {
    setAnswered(null);
    setReveal(false);
    setQuestion(makeQuestion(dataset));
  };

  const reset = () => {
    setScore(0);
    setStreak(0);
    setAnswered(null);
    setReveal(false);
    setQuestion(makeQuestion(dataset));
  };

  const onPick = (picked: Team) => {
    if (!question) return;
    if (answered) return;

    const correct = picked.key === question.correct.key;
    setAnswered({ pickedKey: picked.key, correct });

    if (correct) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else {
      // Score never goes below 0.
      setScore((s) => Math.max(0, s - 1));
      setStreak(0);
    }
  };

  return (
    <HeroHoverProvider>
      <div className="min-h-screen px-4 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-slate-400 font-black">
                Educational
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white">
                GW Counter Teams Quiz
              </h1>
              <div className="text-sm text-slate-300 mt-2">
                Given an enemy squad, recall the best counter team from the
                community logs.
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="px-4 py-2 rounded-xl bg-slate-950/30 glass border border-white/10 text-slate-200 hover:text-white hover:bg-slate-950/40 transition"
              >
                Back
              </Link>
              <button
                onClick={reset}
                className="px-4 py-2 rounded-xl bg-slate-950/30 glass border border-white/10 text-slate-200 hover:text-white hover:bg-slate-950/40 transition"
              >
                Reset Score
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-950/20 glass p-5 rounded-[1.5rem] border border-white/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-black text-blue-300 uppercase tracking-wider">
                    Mode
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Hover heroes for details.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setMode("quiz");
                      setAnswered(null);
                      setReveal(false);
                    }}
                    className={`px-3 py-2 rounded-xl border text-sm font-bold transition ${
                      mode === "quiz"
                        ? "bg-blue-600/70 border-blue-500/30 text-white"
                        : "bg-slate-950/30 glass border-white/10 text-slate-200 hover:text-white"
                    }`}
                  >
                    Quiz
                  </button>
                  <button
                    onClick={() => {
                      setMode("flashcards");
                      setAnswered(null);
                      setReveal(false);
                    }}
                    className={`px-3 py-2 rounded-xl border text-sm font-bold transition ${
                      mode === "flashcards"
                        ? "bg-blue-600/70 border-blue-500/30 text-white"
                        : "bg-slate-950/30 glass border-white/10 text-slate-200 hover:text-white"
                    }`}
                  >
                    Flashcards
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="bg-slate-950/20 glass rounded-2xl border border-white/10 p-4">
                  <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">
                    Score
                  </div>
                  <div className="text-2xl font-black text-white mt-2">
                    {score}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-bold">
                    Never below 0
                  </div>
                </div>
                <div className="bg-slate-950/20 glass rounded-2xl border border-white/10 p-4">
                  <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">
                    Streak
                  </div>
                  <div className="text-2xl font-black text-white mt-2">
                    {streak}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-bold">
                    Correct in a row
                  </div>
                </div>
                <div className="bg-slate-950/20 glass rounded-2xl border border-white/10 p-4">
                  <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">
                    Pool
                  </div>
                  <div className="text-2xl font-black text-white mt-2">
                    {dataset.length}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-bold">
                    Enemy squads
                  </div>
                </div>
              </div>

              <div className="mt-5 text-xs text-slate-400">
                Uses successful community logs; answers are chosen from the most
                supported counters.
              </div>
            </div>

            <div className="lg:col-span-2 bg-slate-950/20 glass p-6 rounded-[1.5rem] border border-white/10">
              {loading ? (
                <div className="text-slate-300">Loading strategy logs…</div>
              ) : error ? (
                <div className="space-y-3">
                  <div className="text-white font-black">
                    Couldn’t load quiz data
                  </div>
                  <div className="text-sm text-slate-300">{error}</div>
                  <div className="text-xs text-slate-500">
                    Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and
                    `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key).
                  </div>
                </div>
              ) : !question ? (
                <div className="text-slate-300">
                  Not enough data yet. Add a few successful strategies first.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.35em] text-slate-500 font-black">
                        Enemy Squad
                      </div>
                      <div className="mt-3">
                        <TeamStrip team={question.enemy} heroById={heroById} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={next}
                        className="px-4 py-2 rounded-xl bg-slate-950/30 glass border border-white/10 text-slate-200 hover:text-white hover:bg-slate-950/40 transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  {mode === "quiz" ? (
                    <div className="space-y-3">
                      <div className="text-xs uppercase tracking-[0.35em] text-slate-500 font-black">
                        Pick the best counter team
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {question.options.map((opt) => {
                          const isCorrect = opt.key === question.correct.key;
                          const isPicked = answered?.pickedKey === opt.key;
                          const show = Boolean(answered);

                          const border = !show
                            ? "border-white/10 hover:border-white/20"
                            : isCorrect
                            ? "border-emerald-400/50"
                            : isPicked
                            ? "border-rose-400/50"
                            : "border-white/10";

                          const ring = !show
                            ? ""
                            : isCorrect
                            ? "ring-2 ring-emerald-400/15"
                            : isPicked
                            ? "ring-2 ring-rose-400/15"
                            : "";

                          return (
                            <button
                              key={opt.key}
                              onClick={() => onPick(opt)}
                              disabled={Boolean(answered)}
                              className={`text-left rounded-2xl bg-slate-950/20 glass border ${border} ${ring} p-4 transition`}
                            >
                              <TeamStrip team={opt} heroById={heroById} />
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 bg-slate-950/20 glass border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200">
                        {!answered ? (
                          <div>
                            Tip: answers are weighted by votes (never negative).
                          </div>
                        ) : answered.correct ? (
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-black text-emerald-300">
                              Correct! +1 score
                            </div>
                            <div className="text-xs text-slate-400 font-bold">
                              (Score can’t drop below 0)
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-black text-rose-300">
                              Not quite. -1 (floored at 0)
                            </div>
                            <div className="text-xs text-slate-400 font-bold">
                              Best counter highlighted in green.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-xs uppercase tracking-[0.35em] text-slate-500 font-black">
                        Flashcard
                      </div>

                      <div className="bg-slate-950/20 glass border border-white/10 rounded-2xl p-5">
                        {!reveal ? (
                          <div className="text-slate-200">
                            Think of the best counter team, then reveal.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="text-xs uppercase tracking-[0.35em] text-slate-500 font-black">
                              Best counter
                            </div>
                            <TeamStrip
                              team={question.correct}
                              heroById={heroById}
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => setReveal((r) => !r)}
                          className="px-4 py-2 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white font-bold text-sm transition"
                        >
                          {reveal ? "Hide" : "Reveal"}
                        </button>
                        <button
                          onClick={() => {
                            setScore((s) => s + 1);
                            setStreak((s) => s + 1);
                            next();
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-950/30 glass border border-white/10 text-slate-200 hover:text-white hover:bg-slate-950/40 transition"
                        >
                          I got it
                        </button>
                        <button
                          onClick={() => {
                            setScore((s) => Math.max(0, s - 1));
                            setStreak(0);
                            next();
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-950/30 glass border border-white/10 text-slate-200 hover:text-white hover:bg-slate-950/40 transition"
                        >
                          I missed
                        </button>
                      </div>

                      <div className="text-xs text-slate-500">
                        Scoring: +1 if you remember, -1 if you miss (never below
                        0).
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </HeroHoverProvider>
  );
}
