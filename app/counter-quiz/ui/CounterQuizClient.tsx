"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Hero, LogType } from "../../../types";
import { HERO_DATABASE } from "../../../constants";
import HeroAvatar from "../../../components/HeroAvatar";
import HeroHoverCard from "../../../components/HeroHoverCard";
import { HeroHoverProvider } from "../../../components/HeroHoverProvider";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browserClient";

type DbStrategyLogRow = {
  id: string;
  enemy_team: string[];
  counter_team: string[];
  type: LogType;
  votes: number;
  created_at: string;
};

type QuestionSeed = {
  enemyTeam: string[];
  correctCounterTeam: string[];
  weight: number;
};

type Question = {
  enemyTeam: string[];
  options: string[][];
  correctKey: string;
};

type DbCounterQuizScoreRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  score: number;
  best_streak: number;
  created_at: string;
};

const AUTO_ADVANCE_MS = 3000;
const MAX_OPTIONS = 4;
const MAX_QUESTIONS = 20;

function clampNonNegative(n: number) {
  return Math.max(0, n);
}

function teamKey(team: string[]) {
  return [...team].sort().join(",");
}

function uniqByKey<T>(items: T[], getKey: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = getKey(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function pickWeighted<T>(items: { item: T; weight: number }[]) {
  const total = items.reduce((acc, x) => acc + Math.max(0, x.weight), 0);
  if (total <= 0) return items.length ? items[0].item : null;
  let r = Math.random() * total;
  for (const x of items) {
    r -= Math.max(0, x.weight);
    if (r <= 0) return x.item;
  }
  return items[items.length - 1]?.item ?? null;
}

function formatWhen(ts: number) {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

function TeamRow({
  ids,
  size = "sm",
  showTier = true,
}: {
  ids: string[];
  size?: "sm" | "md" | "lg";
  showTier?: boolean;
}) {
  const heroesById = useMemo(() => {
    const map = new Map<string, Hero>();
    for (const h of HERO_DATABASE) map.set(h.id, h);
    return map;
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const hero = heroesById.get(id);
        if (!hero) return null;
        return (
          <HeroHoverCard key={id} hero={hero}>
            <span className="inline-flex">
              <HeroAvatar hero={hero} size={size} showTier={showTier} />
            </span>
          </HeroHoverCard>
        );
      })}
    </div>
  );
}

export default function CounterQuizClient() {
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seeds, setSeeds] = useState<QuestionSeed[]>([]);
  const [allCounterTeams, setAllCounterTeams] = useState<string[][]>([]);

  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [runBestStreak, setRunBestStreak] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [runComplete, setRunComplete] = useState(false);

  const [scoreJuice, setScoreJuice] = useState(false);
  const [streakJuice, setStreakJuice] = useState(false);
  const [cardJuice, setCardJuice] = useState<"right" | "wrong" | null>(null);

  const [leaderboard, setLeaderboard] = useState<DbCounterQuizScoreRow[]>([]);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authDisplayName, setAuthDisplayName] = useState<string | null>(null);
  const [personalBest, setPersonalBest] = useState({
    bestScore: 0,
    bestStreak: 0,
  });

  const autoAdvanceRef = useRef<number | null>(null);
  const askedEnemyKeysRef = useRef<Set<string>>(new Set());
  const runSubmittedRef = useRef(false);

  const heroesById = useMemo(() => {
    const map = new Map<string, Hero>();
    for (const h of HERO_DATABASE) map.set(h.id, h);
    return map;
  }, []);

  const normalizeTeam = useMemo(() => {
    return (team: string[]) => {
      const out: string[] = [];
      const seen = new Set<string>();
      for (const id of team) {
        if (typeof id !== "string") continue;
        if (!heroesById.has(id)) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(id);
      }
      return out;
    };
  }, [heroesById]);

  const loadLeaderboard = async (userId: string | null) => {
    if (!supabase) return;

    setLeaderboardError(null);

    const { data: top, error: topError } = await supabase
      .from("counter_quiz_scores")
      .select("id, user_id, display_name, score, best_streak, created_at")
      .order("score", { ascending: false })
      .order("best_streak", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);

    if (topError) {
      console.error("Failed to load leaderboard", topError);
      setLeaderboard([]);
      setLeaderboardError("Failed to load leaderboard.");
    } else {
      setLeaderboard((top as DbCounterQuizScoreRow[] | null) ?? []);
    }

    if (!userId) {
      setPersonalBest({ bestScore: 0, bestStreak: 0 });
      return;
    }

    const { data: bestRow, error: bestErr } = await supabase
      .from("counter_quiz_scores")
      .select("score, best_streak")
      .eq("user_id", userId)
      .order("score", { ascending: false })
      .order("best_streak", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bestErr) {
      console.error("Failed to load personal best", bestErr);
      setPersonalBest({ bestScore: 0, bestStreak: 0 });
      return;
    }

    setPersonalBest({
      bestScore: typeof bestRow?.score === "number" ? bestRow.score : 0,
      bestStreak:
        typeof bestRow?.best_streak === "number" ? bestRow.best_streak : 0,
    });
  };

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    const loadAuthAndScores = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error) {
        console.error("Failed to load auth user", error);
      }

      const user = data.user ?? null;
      const userId = user?.id ?? null;
      setAuthUserId(userId);

      const ingameName =
        typeof user?.user_metadata?.ingame_name === "string"
          ? (user.user_metadata.ingame_name as string)
          : null;
      const email = user?.email ?? null;
      const display = ingameName || (email ? email.split("@")[0] : null);
      setAuthDisplayName(display);
    };

    loadAuthAndScores();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user ?? null;
      const userId = user?.id ?? null;
      setAuthUserId(userId);
      const ingameName =
        typeof user?.user_metadata?.ingame_name === "string"
          ? (user.user_metadata.ingame_name as string)
          : null;
      const email = user?.email ?? null;
      setAuthDisplayName(ingameName || (email ? email.split("@")[0] : null));
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    if (!runComplete) return;
    void loadLeaderboard(authUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, runComplete, authUserId]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setLoadError(
        "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)."
      );
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        setLoadError(
          "Quiz loading is taking too long. This is usually caused by a slow strategy_logs query. Try refreshing, or add the recommended indexes in Supabase."
        );
        setSeeds([]);
        setAllCounterTeams([]);
        setLoading(false);
      }, 15000);

      const { data, error } = await supabase
        .from("strategy_logs")
        .select("id, enemy_team, counter_team, type, votes, created_at")
        .eq("type", "success")
        .gt("votes", 0)
        // NOTE: avoid ORDER BY here; without an index this can be very slow.
        .limit(1200);

      window.clearTimeout(timeout);

      if (timedOut) return;

      if (cancelled) return;

      if (error) {
        console.error("Failed to load strategy_logs", error);
        setLoadError("Failed to load data from Supabase.");
        setSeeds([]);
        setAllCounterTeams([]);
        setLoading(false);
        return;
      }

      const rows = (data as DbStrategyLogRow[] | null) ?? [];

      const enemyToCounters = new Map<
        string,
        {
          enemyTeam: string[];
          counters: Map<string, { counterTeam: string[]; weight: number }>;
        }
      >();

      const counterPool: string[][] = [];

      for (const r of rows) {
        const votes = typeof r.votes === "number" ? r.votes : 0;
        if (votes <= 0) continue;

        const enemy = normalizeTeam(
          Array.isArray(r.enemy_team) ? r.enemy_team : []
        );
        const counter = normalizeTeam(
          Array.isArray(r.counter_team) ? r.counter_team : []
        );
        if (enemy.length === 0 || counter.length === 0) continue;

        const w = votes;
        const eKey = teamKey(enemy);
        const cKey = teamKey(counter);

        const entry =
          enemyToCounters.get(eKey) ??
          (() => {
            const created = {
              enemyTeam: enemy,
              counters: new Map<
                string,
                { counterTeam: string[]; weight: number }
              >(),
            };
            enemyToCounters.set(eKey, created);
            return created;
          })();

        const existing = entry.counters.get(cKey);
        if (existing) existing.weight += w;
        else entry.counters.set(cKey, { counterTeam: counter, weight: w });

        counterPool.push(counter);
      }

      const uniqueCounterPool = uniqByKey(counterPool, teamKey);
      const builtSeeds: QuestionSeed[] = [];

      for (const entry of enemyToCounters.values()) {
        const best = [...entry.counters.values()].sort(
          (a, b) => b.weight - a.weight
        )[0];
        if (!best) continue;
        builtSeeds.push({
          enemyTeam: entry.enemyTeam,
          correctCounterTeam: best.counterTeam,
          weight: Math.max(1, best.weight),
        });
      }

      setSeeds(builtSeeds);
      setAllCounterTeams(uniqueCounterPool);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, normalizeTeam]);

  const buildQuestion = (seed: QuestionSeed): Question => {
    const correctKey = teamKey(seed.correctCounterTeam);
    const options: string[][] = [seed.correctCounterTeam];

    const candidates = allCounterTeams
      .filter((t) => teamKey(t) !== correctKey)
      .sort(() => Math.random() - 0.5);

    for (const t of candidates) {
      if (options.length >= MAX_OPTIONS) break;
      options.push(t);
    }

    options.sort(() => Math.random() - 0.5);

    return {
      enemyTeam: seed.enemyTeam,
      options,
      correctKey,
    };
  };

  const nextQuestion = () => {
    if (runComplete) return;

    if (autoAdvanceRef.current !== null) {
      window.clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }

    setSelectedKey(null);
    setAnswered(false);
    setWasCorrect(null);
    setCardJuice(null);

    if (seeds.length === 0) {
      setQuestion(null);
      return;
    }

    const asked = askedEnemyKeysRef.current;
    let candidates = seeds.filter((s) => !asked.has(teamKey(s.enemyTeam)));
    if (candidates.length === 0) {
      asked.clear();
      candidates = seeds;
    }

    const picked = pickWeighted(
      candidates.map((s) => ({ item: s, weight: Math.max(1, s.weight) }))
    );
    if (!picked) {
      setQuestion(null);
      return;
    }

    asked.add(teamKey(picked.enemyTeam));

    setQuestion(buildQuestion(picked));
  };

  useEffect(() => {
    if (
      !loading &&
      !question &&
      seeds.length > 0 &&
      allCounterTeams.length > 0
    ) {
      nextQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, seeds.length, allCounterTeams.length]);

  useEffect(() => {
    if (!answered) return;
    if (runComplete) return;
    autoAdvanceRef.current = window.setTimeout(() => {
      nextQuestion();
    }, AUTO_ADVANCE_MS);
    return () => {
      if (autoAdvanceRef.current !== null) {
        window.clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered]);

  useEffect(() => {
    if (!scoreJuice) return;
    const t = window.setTimeout(() => setScoreJuice(false), 160);
    return () => window.clearTimeout(t);
  }, [scoreJuice]);

  useEffect(() => {
    if (!streakJuice) return;
    const t = window.setTimeout(() => setStreakJuice(false), 160);
    return () => window.clearTimeout(t);
  }, [streakJuice]);

  useEffect(() => {
    if (!cardJuice) return;
    const t = window.setTimeout(() => setCardJuice(null), 220);
    return () => window.clearTimeout(t);
  }, [cardJuice]);

  const submitRun = async (finalScore: number, bestStreakNow: number) => {
    if (!supabase) return;
    if (!authUserId) {
      setLeaderboardError("Sign in to submit scores to the leaderboard.");
      return;
    }
    const displayName = authDisplayName;

    const { error } = await supabase.from("counter_quiz_scores").insert({
      user_id: authUserId,
      display_name: displayName,
      score: finalScore,
      best_streak: bestStreakNow,
    });

    if (error) {
      console.error("Failed to submit score", error);
      setLeaderboardError("Failed to submit score.");
      return;
    }

    await loadLeaderboard(authUserId);
  };

  const answer = async (optionTeam: string[]) => {
    if (!question || answered || runComplete) return;

    const key = teamKey(optionTeam);
    const correct = key === question.correctKey;
    setSelectedKey(key);
    setAnswered(true);
    setWasCorrect(correct);

    const nextScore = correct ? score + 1 : clampNonNegative(score - 1);
    const nextStreak = correct ? streak + 1 : 0;
    const nextBestStreak = correct
      ? Math.max(runBestStreak, nextStreak)
      : runBestStreak;

    setScore(nextScore);
    setStreak(nextStreak);
    setRunBestStreak(nextBestStreak);

    if (correct) {
      setScoreJuice(true);
      setStreakJuice(true);
      setCardJuice("right");
    } else {
      setScoreJuice(true);
      setCardJuice("wrong");
    }

    const nextAnswered = questionsAnswered + 1;
    setQuestionsAnswered(nextAnswered);
    if (nextAnswered >= MAX_QUESTIONS) {
      setRunComplete(true);
      if (!runSubmittedRef.current) {
        runSubmittedRef.current = true;
        await submitRun(nextScore, nextBestStreak);
      }
    }
  };

  const reset = async () => {
    if (!runComplete && (score > 0 || streak > 0 || runBestStreak > 0)) {
      await submitRun(score, Math.max(runBestStreak, streak));
    }
    setScore(0);
    setStreak(0);
    setRunBestStreak(0);
    setQuestionsAnswered(0);
    setRunComplete(false);
    askedEnemyKeysRef.current.clear();
    runSubmittedRef.current = false;
    nextQuestion();
  };

  const correctTeam = useMemo(() => {
    if (!question) return null;
    return (
      question.options.find((t) => teamKey(t) === question.correctKey) ?? null
    );
  }, [question]);

  const selectedTeam = useMemo(() => {
    if (!question || !selectedKey) return null;
    return question.options.find((t) => teamKey(t) === selectedKey) ?? null;
  }, [question, selectedKey]);

  const cardTransform =
    cardJuice === "right"
      ? "scale(1.02)"
      : cardJuice === "wrong"
      ? "translateX(-6px)"
      : "scale(1)";

  if (!supabase) {
    return (
      <div className="min-h-screen px-4 py-10 flex items-center justify-center">
        <div className="w-full max-w-xl bg-slate-950/20 glass p-6 rounded-[1.75rem] border border-white/10">
          <div className="text-lg font-black text-white">GW Counter Quiz</div>
          <div className="text-sm text-slate-300 mt-2">{loadError}</div>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex px-4 py-2 rounded-xl bg-slate-950/30 glass border border-white/10 text-slate-200 hover:text-white hover:bg-slate-950/40 transition"
            >
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HeroHoverProvider>
      <div className="min-h-screen px-4 py-10 flex items-center justify-center">
        <div className="w-full max-w-5xl">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="px-4 py-2 rounded-xl bg-slate-950/30 glass border border-white/10 text-slate-200 hover:text-white hover:bg-slate-950/40 transition"
            >
              Back
            </Link>
            {runComplete ? (
              <button
                onClick={reset}
                className="px-4 py-2 rounded-xl bg-slate-950/30 glass border border-white/10 text-slate-200 hover:text-white hover:bg-slate-950/40 transition"
              >
                Start New Run
              </button>
            ) : (
              <button
                onClick={reset}
                className="px-4 py-2 rounded-xl bg-slate-950/30 glass border border-white/10 text-slate-200 hover:text-white hover:bg-slate-950/40 transition"
              >
                Reset Run
              </button>
            )}
          </div>

          <div className="mt-6">
            {runComplete ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
                <div className="bg-slate-950/20 glass p-6 rounded-[1.75rem] border border-white/10">
                  <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-black">
                    Report Card
                  </div>
                  <div className="text-3xl font-black text-white mt-2">
                    Final score: {score}
                  </div>
                  <div className="text-sm text-slate-300 font-bold mt-2">
                    Best streak: {Math.max(runBestStreak, streak)} · Questions:{" "}
                    {MAX_QUESTIONS}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/20 glass rounded-2xl border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">
                        Best (you)
                      </div>
                      <div className="text-xl font-black text-slate-200 mt-1">
                        {personalBest.bestScore}
                        <span className="text-sm font-black text-slate-400">
                          {" "}
                          score
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-bold">
                        {personalBest.bestStreak} streak
                      </div>
                    </div>
                    <div className="bg-slate-950/20 glass rounded-2xl border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">
                        Submission
                      </div>
                      {!authUserId ? (
                        <div className="text-[11px] text-slate-300 font-bold mt-1">
                          Sign in to submit scores.
                        </div>
                      ) : leaderboardError ? (
                        <div className="text-[11px] text-rose-300 font-bold mt-1">
                          {leaderboardError}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-300 font-bold mt-1">
                          Submitted to global leaderboard.
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500 font-bold mt-1">
                        Auto-submitted on completion.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/20 glass p-5 rounded-[1.75rem] border border-white/10 h-fit">
                  <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-black">
                    Leaderboard
                  </div>
                  <div className="text-xs text-slate-400 font-bold mt-1">
                    Global top runs.
                  </div>

                  <div className="mt-4 space-y-2">
                    {leaderboard.length === 0 ? (
                      <div className="text-sm text-slate-300 font-bold">
                        No scores yet.
                      </div>
                    ) : (
                      leaderboard.slice(0, 10).map((x, idx) => (
                        <div
                          key={x.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/20 glass px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-200 truncate">
                              #{idx + 1} {x.score} score
                            </div>
                            <div className="text-[11px] text-slate-400 font-bold">
                              {x.best_streak} streak{" "}
                              {formatWhen(new Date(x.created_at).getTime())}
                            </div>
                            <div className="text-[11px] text-slate-500 font-bold truncate">
                              {x.display_name || "Unknown"}
                            </div>
                          </div>
                          <div className="text-xs font-black text-slate-300">
                            {idx === 0 ? "Best" : ""}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-3xl">
                <div className="bg-slate-950/20 glass p-5 rounded-[1.75rem] border border-white/10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-black">
                        GW Counter Quiz
                      </div>
                      <div className="text-sm text-slate-300 mt-1">
                        Pick the best counter team. Auto-advances in{" "}
                        {AUTO_ADVANCE_MS / 1000}s.
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">
                        Progress
                      </div>
                      <div className="text-xs text-slate-300 font-bold mt-1">
                        {questionsAnswered}/{MAX_QUESTIONS}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/20 glass rounded-2xl border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">
                        Score
                      </div>
                      <div
                        className={`text-4xl font-black text-white mt-1 transition-transform duration-150 origin-left ${
                          scoreJuice ? "scale-110" : "scale-100"
                        }`}
                      >
                        {score}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-bold">
                        &nbsp;
                      </div>
                    </div>

                    <div className="bg-slate-950/20 glass rounded-2xl border border-white/10 p-4">
                      <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">
                        Streak
                      </div>
                      <div
                        className={`text-4xl font-black text-white mt-1 transition-transform duration-150 origin-left ${
                          streakJuice ? "scale-110" : "scale-100"
                        }`}
                      >
                        {streak}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-bold">
                        Best this run: {Math.max(runBestStreak, streak)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div
                      className="mx-auto w-full"
                      style={{ perspective: "1200px" }}
                    >
                      <div
                        className="relative w-full"
                        style={{
                          transform: cardTransform,
                          transition: "transform 180ms ease",
                        }}
                      >
                        <div
                          className="relative w-full"
                          style={{
                            transformStyle: "preserve-3d",
                            transition:
                              "transform 420ms cubic-bezier(0.2, 0.9, 0.2, 1)",
                            transform: answered
                              ? "rotateY(180deg)"
                              : "rotateY(0deg)",
                          }}
                        >
                          <div
                            className="rounded-[1.75rem] border border-white/10 bg-slate-950/20 glass p-5"
                            style={{
                              backfaceVisibility: "hidden",
                              WebkitBackfaceVisibility: "hidden",
                            }}
                          >
                            {loading ? (
                              <div className="text-slate-300 font-bold">
                                Loading quiz...
                              </div>
                            ) : loadError ? (
                              <div className="text-slate-300 font-bold">
                                {loadError}
                              </div>
                            ) : !question ? (
                              <div className="text-slate-300 font-bold">
                                Not enough data yet.
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-black">
                                      Enemy Team
                                    </div>
                                    <div className="mt-2">
                                      <TeamRow
                                        ids={question.enemyTeam}
                                        size="md"
                                      />
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">
                                      Choose Counter
                                    </div>
                                    <div className="text-xs text-slate-400 font-bold mt-1">
                                      Tap an option
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {question.options.map((opt) => {
                                    const key = teamKey(opt);
                                    return (
                                      <button
                                        key={key}
                                        onClick={() => void answer(opt)}
                                        className="group text-left rounded-2xl border border-white/10 bg-slate-950/20 glass p-4 transition will-change-transform hover:bg-slate-950/30 hover:border-white/20 hover:-translate-y-0.5 hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-white/20"
                                      >
                                        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">
                                          Counter Team
                                        </div>
                                        <div className="mt-2">
                                          <TeamRow ids={opt} size="sm" />
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>

                          <div
                            className="absolute inset-0 rounded-[1.75rem] border border-white/10 bg-slate-950/20 glass p-5"
                            style={{
                              transform: "rotateY(180deg)",
                              backfaceVisibility: "hidden",
                              WebkitBackfaceVisibility: "hidden",
                            }}
                          >
                            {!question ? null : (
                              <>
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-black">
                                      Result
                                    </div>
                                    <div
                                      className={`text-2xl font-black mt-1 ${
                                        wasCorrect
                                          ? "text-emerald-300"
                                          : "text-rose-300"
                                      }`}
                                    >
                                      {wasCorrect ? "Correct" : "Wrong"}
                                    </div>
                                    <div className="text-xs text-slate-300 font-bold mt-2">
                                      Next in {AUTO_ADVANCE_MS / 1000}s
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">
                                      Enemy
                                    </div>
                                    <div className="mt-2 flex justify-end">
                                      <TeamRow
                                        ids={question.enemyTeam}
                                        size="md"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="rounded-2xl border border-white/10 bg-slate-950/20 glass p-4">
                                    <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">
                                      Your Pick
                                    </div>
                                    <div className="mt-2">
                                      {selectedTeam ? (
                                        <TeamRow ids={selectedTeam} />
                                      ) : (
                                        <div className="text-sm text-slate-400 font-bold"></div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-slate-950/20 glass p-4">
                                    <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 font-black">
                                      Best Counter
                                    </div>
                                    <div className="mt-2">
                                      {correctTeam ? (
                                        <TeamRow ids={correctTeam} />
                                      ) : (
                                        <div className="text-sm text-slate-400 font-bold"></div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </HeroHoverProvider>
  );
}
