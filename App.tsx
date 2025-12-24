import React, { useEffect, useMemo, useState } from "react";
import { StrategyLog, LogType, Hero } from "./types";
import StrategyForm from "./components/StrategyForm";
import StrategyCard from "./components/StrategyCard";
import HeroAutocomplete from "./components/HeroAutocomplete";
import AuthModal from "./components/AuthModal";
import { getSupabaseBrowserClient } from "./lib/supabase/browserClient";
import { HERO_DATABASE } from "./constants";

type DbStrategyLogRow = {
  id: string;
  enemy_team: string[];
  counter_team: string[];
  type: LogType;
  notes: string;
  votes: number;
  author_id: string;
  author_email: string | null;
  author_name: string | null;
  created_at: string;
};

function toStrategyLog(row: DbStrategyLogRow): StrategyLog {
  return {
    id: row.id,
    enemyTeam: row.enemy_team,
    counterTeam: row.counter_team,
    type: row.type,
    notes: row.notes,
    votes: row.votes,
    author: row.author_name || row.author_email || "Unknown",
    createdAt: new Date(row.created_at).getTime(),
  };
}

interface AddLogState {
  enemyIds?: string[];
  type?: LogType;
}

const App: React.FC = () => {
  const [logs, setLogs] = useState<StrategyLog[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [addState, setAddState] = useState<AddLogState>({});
  const [filterHeroIds, setFilterHeroIds] = useState<string[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<
    "post" | "vote" | "generic"
  >("generic");
  const [loading, setLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [supabaseReady, setSupabaseReady] = useState(true);

  // New filter states
  const [activeTab, setActiveTab] = useState<"reports" | "stats">("reports");
  const [sortBy, setSortBy] = useState<"votes" | "date">("votes");
  const [typeFilter, setTypeFilter] = useState<"all" | "success" | "fail">(
    "all"
  );
  const [minVotes, setMinVotes] = useState<number>(0);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setSupabaseReady(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const [{ data: sessionData }, { data: userData }] = await Promise.all([
        client.auth.getSession(),
        client.auth.getUser(),
      ]);

      if (cancelled) return;
      const sessionUser = sessionData.session?.user ?? null;
      const user = userData.user ?? sessionUser;
      setAuthEmail(user?.email ?? null);

      const { data, error } = await client
        .from("strategy_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("Failed to load logs", error);
        setLogs([]);
      } else {
        setLogs((data as DbStrategyLogRow[]).map(toStrategyLog));
      }
      setLoading(false);
    };

    load();

    const { data: sub } = client.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user ?? null;
        setAuthEmail(user?.email ?? null);
      }
    );

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const ensureSignedIn = (reason: "post" | "vote") => {
    if (!authEmail) {
      setAuthModalReason(reason);
      setAuthModalOpen(true);
      return false;
    }
    return true;
  };

  const handleCreateLog = async (
    data: Pick<StrategyLog, "enemyTeam" | "counterTeam" | "type" | "notes">
  ) => {
    if (!ensureSignedIn("post")) return;

    const client = getSupabaseBrowserClient();
    if (!client) return;

    const { data: userData } = await client.auth.getUser();
    const user = userData.user;
    if (!user) {
      setAuthModalReason("post");
      setAuthModalOpen(true);
      return;
    }

    const anyUser = user as unknown as {
      user_metadata?: Record<string, unknown>;
    };
    const authorName =
      typeof anyUser?.user_metadata?.ingame_name === "string"
        ? (anyUser.user_metadata.ingame_name as string)
        : null;

    const { data: inserted, error } = await client
      .from("strategy_logs")
      .insert({
        enemy_team: data.enemyTeam,
        counter_team: data.counterTeam,
        type: data.type,
        notes: data.notes,
        author_id: user.id,
        author_email: user.email,
        author_name: authorName,
      })
      .select("*")
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    const newLog = toStrategyLog(inserted as DbStrategyLogRow);
    setLogs((prev) => [newLog, ...prev]);
    setShowForm(false);
    setAddState({});
  };

  const handleVote = async (id: string, type: "up" | "down") => {
    if (!ensureSignedIn("vote")) return;

    const client = getSupabaseBrowserClient();
    if (!client) return;

    const { data: userData } = await client.auth.getUser();
    const user = userData.user;
    if (!user) {
      setAuthModalReason("vote");
      setAuthModalOpen(true);
      return;
    }

    const desired = type === "up" ? 1 : -1;

    const { data: existingVote, error: existingError } = await client
      .from("log_votes")
      .select("value")
      .eq("log_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      alert(existingError.message);
      return;
    }

    const oldValue = (existingVote as { value?: number } | null)?.value ?? 0;

    if (oldValue === desired) {
      const { error } = await client
        .from("log_votes")
        .delete()
        .eq("log_id", id)
        .eq("user_id", user.id);
      if (error) {
        alert(error.message);
        return;
      }
    } else {
      const { error } = await client
        .from("log_votes")
        .upsert(
          { log_id: id, user_id: user.id, value: desired },
          { onConflict: "log_id,user_id" }
        );
      if (error) {
        alert(error.message);
        return;
      }
    }

    // Pull the authoritative total (trigger-maintained) and update UI.
    const { data: updatedLog, error: updatedError } = await client
      .from("strategy_logs")
      .select("id,votes")
      .eq("id", id)
      .single();

    if (updatedError) {
      alert(updatedError.message);
      return;
    }

    setLogs((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, votes: (updatedLog as { votes: number }).votes }
          : l
      )
    );
  };

  const openAddLog = (enemyIds?: string[], type?: LogType) => {
    if (!ensureSignedIn("post")) return;
    setAddState({ enemyIds, type });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Group logs by unique enemy squad
  const groupedLogs = useMemo(() => {
    const groups: Record<string, StrategyLog[]> = {};

    let filtered = logs;

    // Filter by hero tags (must include ALL selected heroes in either enemy or counter team)
    if (filterHeroIds.length > 0) {
      filtered = logs.filter((l) =>
        filterHeroIds.every(
          (heroId) =>
            l.enemyTeam.includes(heroId) || l.counterTeam.includes(heroId)
        )
      );
    }

    // Filter by type
    if (typeFilter !== "all") {
      filtered = filtered.filter((l) => l.type === typeFilter);
    }

    filtered.forEach((log) => {
      const key = [...log.enemyTeam].sort().join(",");
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });

    // Filter by min votes (total votes for the squad)
    let entries = Object.entries(groups);
    if (minVotes > 0) {
      entries = entries.filter(([_, squadLogs]) => {
        const totalVotes = squadLogs.reduce((sum, l) => sum + l.votes, 0);
        return totalVotes >= minVotes;
      });
    }

    // Sort squads
    return entries.sort((a, b) => {
      if (sortBy === "votes") {
        const votesA = a[1].reduce((sum, l) => sum + l.votes, 0);
        const votesB = b[1].reduce((sum, l) => sum + l.votes, 0);
        return votesB - votesA;
      } else {
        // Sort by most recent
        const dateA = Math.max(...a[1].map((l) => l.createdAt));
        const dateB = Math.max(...b[1].map((l) => l.createdAt));
        return dateB - dateA;
      }
    });
  }, [logs, filterHeroIds, sortBy, typeFilter, minVotes]);

  // Stats calculations
  const stats = useMemo(() => {
    const getHero = (id: string) => HERO_DATABASE.find((h) => h.id === id);

    // Most failed enemy teams (teams with most fail reports)
    const enemyFailCounts: Record<
      string,
      { count: number; enemyIds: string[] }
    > = {};
    logs.forEach((log) => {
      if (log.type === "fail") {
        const key = [...log.enemyTeam].sort().join(",");
        if (!enemyFailCounts[key]) {
          enemyFailCounts[key] = { count: 0, enemyIds: log.enemyTeam };
        }
        enemyFailCounts[key].count++;
      }
    });
    const mostFailedTeams = Object.values(enemyFailCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Most successful counter teams
    const counterSuccessCounts: Record<
      string,
      { count: number; counterIds: string[] }
    > = {};
    logs.forEach((log) => {
      if (log.type === "success") {
        const key = [...log.counterTeam].sort().join(",");
        if (!counterSuccessCounts[key]) {
          counterSuccessCounts[key] = { count: 0, counterIds: log.counterTeam };
        }
        counterSuccessCounts[key].count++;
      }
    });
    const mostSuccessfulCounters = Object.values(counterSuccessCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Most reported enemy heroes
    const enemyHeroCounts: Record<string, number> = {};
    logs.forEach((log) => {
      log.enemyTeam.forEach((heroId) => {
        enemyHeroCounts[heroId] = (enemyHeroCounts[heroId] || 0) + 1;
      });
    });
    const mostReportedEnemies = Object.entries(enemyHeroCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([heroId, count]) => ({ hero: getHero(heroId), count }));

    // Top counter heroes (used in successful strategies)
    const counterHeroCounts: Record<string, number> = {};
    logs.forEach((log) => {
      if (log.type === "success") {
        log.counterTeam.forEach((heroId) => {
          counterHeroCounts[heroId] = (counterHeroCounts[heroId] || 0) + 1;
        });
      }
    });
    const topCounterHeroes = Object.entries(counterHeroCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([heroId, count]) => ({ hero: getHero(heroId), count }));

    // Win rate per enemy squad (success vs fail ratio)
    const squadStats: Record<
      string,
      { success: number; fail: number; enemyIds: string[] }
    > = {};
    logs.forEach((log) => {
      const key = [...log.enemyTeam].sort().join(",");
      if (!squadStats[key]) {
        squadStats[key] = { success: 0, fail: 0, enemyIds: log.enemyTeam };
      }
      if (log.type === "success") squadStats[key].success++;
      else squadStats[key].fail++;
    });

    const squadWinRates = Object.values(squadStats)
      .map((stat) => ({
        ...stat,
        total: stat.success + stat.fail,
        winRate: stat.success / (stat.success + stat.fail),
      }))
      .filter((stat) => stat.total >= 3) // Only show squads with 3+ reports
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 5);

    const squadLossRates = Object.values(squadStats)
      .map((stat) => ({
        ...stat,
        total: stat.success + stat.fail,
        lossRate: stat.fail / (stat.success + stat.fail),
      }))
      .filter((stat) => stat.total >= 3)
      .sort((a, b) => b.lossRate - a.lossRate)
      .slice(0, 5);

    // Top heroes for defense (offense heroes used in counter teams - all reports)
    const offenseHeroStats: Record<
      string,
      { total: number; wins: number; losses: number }
    > = {};
    logs.forEach((log) => {
      log.counterTeam.forEach((heroId) => {
        if (!offenseHeroStats[heroId]) {
          offenseHeroStats[heroId] = { total: 0, wins: 0, losses: 0 };
        }
        offenseHeroStats[heroId].total++;
        if (log.type === "success") {
          offenseHeroStats[heroId].wins++;
        } else {
          offenseHeroStats[heroId].losses++;
        }
      });
    });
    const topOffenseHeroes = Object.entries(offenseHeroStats)
      .map(([heroId, stats]) => ({
        hero: getHero(heroId),
        total: stats.total,
        wins: stats.wins,
        losses: stats.losses,
        winRate: stats.total > 0 ? stats.wins / stats.total : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Top heroes for defense (defense heroes appearing in enemy teams)
    const defenseHeroStats: Record<
      string,
      { total: number; wins: number; losses: number }
    > = {};
    logs.forEach((log) => {
      log.enemyTeam.forEach((heroId) => {
        if (!defenseHeroStats[heroId]) {
          defenseHeroStats[heroId] = { total: 0, wins: 0, losses: 0 };
        }
        defenseHeroStats[heroId].total++;
        if (log.type === "fail") {
          // Defense "wins" when counters fail
          defenseHeroStats[heroId].wins++;
        } else {
          defenseHeroStats[heroId].losses++;
        }
      });
    });
    const topDefenseHeroes = Object.entries(defenseHeroStats)
      .map(([heroId, stats]) => ({
        hero: getHero(heroId),
        total: stats.total,
        wins: stats.wins,
        losses: stats.losses,
        winRate: stats.total > 0 ? stats.wins / stats.total : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Overall stats
    const totalReports = logs.length;
    const totalSuccess = logs.filter((l) => l.type === "success").length;
    const totalFail = logs.filter((l) => l.type === "fail").length;
    const uniqueSquads = new Set(
      logs.map((l) => [...l.enemyTeam].sort().join(","))
    ).size;
    const avgVotes =
      logs.length > 0
        ? logs.reduce((sum, l) => sum + l.votes, 0) / logs.length
        : 0;

    return {
      mostFailedTeams,
      mostSuccessfulCounters,
      mostReportedEnemies,
      topCounterHeroes,
      squadWinRates,
      squadLossRates,
      topOffenseHeroes,
      topDefenseHeroes,
      totalReports,
      totalSuccess,
      totalFail,
      uniqueSquads,
      avgVotes,
    };
  }, [logs]);

  const getHero = (id: string) => HERO_DATABASE.find((h) => h.id === id);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
      <AuthModal
        open={authModalOpen}
        reason={authModalReason}
        onClose={() => setAuthModalOpen(false)}
      />

      {!supabaseReady ? (
        <div className="mb-8 p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-200">
          Missing Supabase env vars. Add{" "}
          <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
          <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> (or{" "}
          <span className="font-mono">
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          </span>
          ) in <span className="font-mono">.env.local</span>.
        </div>
      ) : null}

      <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_10px_30px_rgba(37,99,235,0.4)] rotate-3">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white italic uppercase leading-none">
              REBIRTH
              <br />
              <span className="text-blue-500">GW INTEL</span>
            </h1>
          </div>
          <p className="text-slate-400 max-w-lg font-medium border-l-2 border-slate-700 pl-6">
            The elite collaborative vault for{" "}
            <span className="text-blue-400 font-bold italic">
              Seven Knights Rebirth
            </span>{" "}
            guild operations. Counter the meta or report critical failures.
          </p>
        </div>

        {!showForm && (
          <button
            onClick={() => openAddLog()}
            className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-2xl hover:scale-105 active:scale-95 flex items-center gap-3 uppercase tracking-widest text-sm italic"
          >
            <span>NEW SQUAD REPORT</span>
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}
      </header>

      <main className="space-y-12">
        {loading ? (
          <div className="p-10 rounded-3xl border border-slate-800 bg-slate-900/40 text-slate-400">
            Loading intelligence...
          </div>
        ) : null}
        {showForm && (
          <StrategyForm
            onSubmit={handleCreateLog}
            onCancel={() => {
              setShowForm(false);
              setAddState({});
            }}
            initialEnemyTeam={addState.enemyIds}
            initialType={addState.type}
          />
        )}

        {/* Tab Navigation */}
        <div className="flex gap-4 border-b-2 border-slate-700/50">
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-8 py-4 font-black text-sm uppercase tracking-wider transition-all relative ${
              activeTab === "reports"
                ? "text-blue-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:bg-blue-500 after:rounded-t-full"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Squad Reports
            <span className="ml-2 px-2 py-1 bg-slate-800 rounded-lg text-xs">
              {groupedLogs.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-8 py-4 font-black text-sm uppercase tracking-wider transition-all relative ${
              activeTab === "stats"
                ? "text-emerald-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:bg-emerald-500 after:rounded-t-full"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Intel Stats
          </button>
        </div>

        {/* Improved Filter UI with Tags */}
        {activeTab === "reports" && (
          <div className="bg-slate-800/60 p-6 rounded-[2rem] border-2 border-slate-700/50 space-y-4 shadow-xl backdrop-blur-md">
            {/* Hero Tags Search */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center gap-3 text-slate-400 whitespace-nowrap">
                <div className="p-2 bg-slate-700 rounded-lg">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-xs font-black uppercase tracking-[0.2em]">
                  Intel Search
                </span>
              </div>
              <div className="flex-1 w-full">
                <HeroAutocomplete
                  onSelect={(h) => {
                    if (!filterHeroIds.includes(h.id)) {
                      setFilterHeroIds([...filterHeroIds, h.id]);
                    }
                  }}
                  placeholder="Add heroes to filter (click to add tags)..."
                  className="flex-1"
                />
              </div>
            </div>

            {/* Selected Hero Tags */}
            {filterHeroIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filterHeroIds.map((heroId) => {
                  const hero = getHero(heroId);
                  return hero ? (
                    <div
                      key={heroId}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-300 font-bold text-sm"
                    >
                      <span>{hero.name}</span>
                      <button
                        onClick={() =>
                          setFilterHeroIds(
                            filterHeroIds.filter((id) => id !== heroId)
                          )
                        }
                        className="hover:text-red-400 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
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
                  ) : null;
                })}
                <button
                  onClick={() => setFilterHeroIds([])}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-black transition-all"
                >
                  CLEAR ALL
                </button>
              </div>
            )}

            {/* Filter Controls */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-700/50">
              <div className="flex items-center gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Sort:
                </label>
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as "votes" | "date")
                  }
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm font-bold text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="votes">Most Upvoted</option>
                  <option value="date">Most Recent</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Type:
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value as "all" | "success" | "fail")
                  }
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm font-bold text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Reports</option>
                  <option value="success">Success Only</option>
                  <option value="fail">Fail Only</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Min Votes:
                </label>
                <input
                  type="number"
                  value={minVotes}
                  onChange={(e) =>
                    setMinVotes(Math.max(0, parseInt(e.target.value) || 0))
                  }
                  className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm font-bold text-white focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "reports" ? (
          <div className="space-y-12">
            {groupedLogs.length > 0 ? (
              groupedLogs.map(([key, logs]) => (
                <StrategyCard
                  key={key}
                  enemyIds={key.split(",")}
                  logs={logs}
                  onVote={handleVote}
                  onAddLog={openAddLog}
                />
              ))
            ) : (
              <div className="col-span-full py-32 flex flex-col items-center justify-center text-slate-700 bg-slate-800/20 rounded-[3rem] border-4 border-dashed border-slate-800">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                  <svg
                    className="w-12 h-12 opacity-20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xl font-black italic uppercase tracking-widest">
                  No Intelligence Data
                </p>
                <button
                  onClick={() => openAddLog()}
                  className="mt-6 text-blue-500 font-bold hover:underline"
                >
                  Click here to start a new squad record
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Stats Tab */
          <div className="space-y-8">
            {/* Overview Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-2xl p-6 text-center">
                <div className="text-4xl font-black text-blue-400">
                  {stats.totalReports}
                </div>
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 mt-2">
                  Total Reports
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-2xl p-6 text-center">
                <div className="text-4xl font-black text-emerald-400">
                  {stats.totalSuccess}
                </div>
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 mt-2">
                  Successful
                </div>
              </div>
              <div className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border border-rose-500/20 rounded-2xl p-6 text-center">
                <div className="text-4xl font-black text-rose-400">
                  {stats.totalFail}
                </div>
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 mt-2">
                  Failed
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-2xl p-6 text-center">
                <div className="text-4xl font-black text-purple-400">
                  {stats.uniqueSquads}
                </div>
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 mt-2">
                  Unique Squads
                </div>
              </div>
              <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-6 text-center">
                <div className="text-4xl font-black text-amber-400">
                  {stats.avgVotes.toFixed(1)}
                </div>
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 mt-2">
                  Avg Votes
                </div>
              </div>
            </div>

            {/* Most Reported Enemy Heroes */}
            <div className="bg-slate-800/60 p-8 rounded-[2rem] border-2 border-slate-700/50">
              <h3 className="text-xl font-black text-rose-400 uppercase tracking-wider mb-6 flex items-center gap-3">
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                Most Reported Enemy Heroes
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {stats.mostReportedEnemies.map(({ hero, count }) =>
                  hero ? (
                    <div
                      key={hero.id}
                      className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 text-center"
                    >
                      <div className="text-2xl font-black text-white">
                        {hero.name}
                      </div>
                      <div className="text-sm text-rose-400 font-bold mt-1">
                        {count} reports
                      </div>
                      <div className="text-xs text-slate-500 mt-2 capitalize">
                        {hero.attackType}
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </div>

            {/* Top Counter Heroes */}
            <div className="bg-slate-800/60 p-8 rounded-[2rem] border-2 border-slate-700/50">
              <h3 className="text-xl font-black text-emerald-400 uppercase tracking-wider mb-6 flex items-center gap-3">
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Top Counter Heroes (in Successful Strategies)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {stats.topCounterHeroes.map(({ hero, count }) =>
                  hero ? (
                    <div
                      key={hero.id}
                      className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 text-center"
                    >
                      <div className="text-2xl font-black text-white">
                        {hero.name}
                      </div>
                      <div className="text-sm text-emerald-400 font-bold mt-1">
                        {count} wins
                      </div>
                      <div className="text-xs text-slate-500 mt-2 capitalize">
                        {hero.attackType}
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </div>

            {/* Top Heroes for Offense (with win rates) */}
            <div className="bg-slate-800/60 p-8 rounded-[2rem] border-2 border-slate-700/50">
              <h3 className="text-xl font-black text-blue-400 uppercase tracking-wider mb-6 flex items-center gap-3">
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
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Top Offense Heroes (Most Used in Attacks)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {stats.topOffenseHeroes.map(
                  ({ hero, total, wins, losses, winRate }) =>
                    hero ? (
                      <div
                        key={hero.id}
                        className="bg-slate-900/40 p-4 rounded-xl border border-blue-500/20 text-center"
                      >
                        <div className="text-xl font-black text-white">
                          {hero.name}
                        </div>
                        <div className="text-sm text-blue-400 font-bold mt-1">
                          {total} uses
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-2 text-xs">
                          <span className="text-emerald-400 font-bold">
                            {wins}W
                          </span>
                          <span className="text-slate-500">-</span>
                          <span className="text-rose-400 font-bold">
                            {losses}L
                          </span>
                        </div>
                        <div
                          className={`text-xs font-black mt-2 ${
                            winRate >= 0.6
                              ? "text-emerald-400"
                              : winRate >= 0.4
                              ? "text-amber-400"
                              : "text-rose-400"
                          }`}
                        >
                          {(winRate * 100).toFixed(0)}% Win Rate
                        </div>
                        <div className="text-xs text-slate-500 mt-1 capitalize">
                          {hero.attackType}
                        </div>
                      </div>
                    ) : null
                )}
              </div>
            </div>

            {/* Top Heroes for Defense (with defense rates) */}
            <div className="bg-slate-800/60 p-8 rounded-[2rem] border-2 border-slate-700/50">
              <h3 className="text-xl font-black text-orange-400 uppercase tracking-wider mb-6 flex items-center gap-3">
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
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                Top Defense Heroes (Most Used in Enemy Squads)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {stats.topDefenseHeroes.map(
                  ({ hero, total, wins, losses, winRate }) =>
                    hero ? (
                      <div
                        key={hero.id}
                        className="bg-slate-900/40 p-4 rounded-xl border border-orange-500/20 text-center"
                      >
                        <div className="text-xl font-black text-white">
                          {hero.name}
                        </div>
                        <div className="text-sm text-orange-400 font-bold mt-1">
                          {total} appearances
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-2 text-xs">
                          <span className="text-emerald-400 font-bold">
                            {wins} defended
                          </span>
                          <span className="text-slate-500">-</span>
                          <span className="text-rose-400 font-bold">
                            {losses} broken
                          </span>
                        </div>
                        <div
                          className={`text-xs font-black mt-2 ${
                            winRate >= 0.6
                              ? "text-emerald-400"
                              : winRate >= 0.4
                              ? "text-amber-400"
                              : "text-rose-400"
                          }`}
                        >
                          {(winRate * 100).toFixed(0)}% Defense Rate
                        </div>
                        <div className="text-xs text-slate-500 mt-1 capitalize">
                          {hero.attackType}
                        </div>
                      </div>
                    ) : null
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Most Failed Enemy Teams */}
              <div className="bg-slate-800/60 p-8 rounded-[2rem] border-2 border-slate-700/50">
                <h3 className="text-lg font-black text-rose-400 uppercase tracking-wider mb-6">
                  💀 Most Failed Enemy Teams
                </h3>
                <div className="space-y-4">
                  {stats.mostFailedTeams.map(({ enemyIds, count }, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900/40 p-4 rounded-xl border border-rose-500/20 flex items-center justify-between"
                    >
                      <div className="flex flex-wrap gap-2">
                        {enemyIds.map((id) => {
                          const hero = getHero(id);
                          return hero ? (
                            <span
                              key={id}
                              className="text-xs font-bold px-2 py-1 bg-rose-500/10 text-rose-300 rounded-lg"
                            >
                              {hero.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                      <div className="text-rose-400 font-black text-xl">
                        {count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Most Successful Counter Teams */}
              <div className="bg-slate-800/60 p-8 rounded-[2rem] border-2 border-slate-700/50">
                <h3 className="text-lg font-black text-emerald-400 uppercase tracking-wider mb-6">
                  ✨ Most Successful Counter Teams
                </h3>
                <div className="space-y-4">
                  {stats.mostSuccessfulCounters.map(
                    ({ counterIds, count }, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900/40 p-4 rounded-xl border border-emerald-500/20 flex items-center justify-between"
                      >
                        <div className="flex flex-wrap gap-2">
                          {counterIds.map((id) => {
                            const hero = getHero(id);
                            return hero ? (
                              <span
                                key={id}
                                className="text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-300 rounded-lg"
                              >
                                {hero.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                        <div className="text-emerald-400 font-black text-xl">
                          {count}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Highest Win Rate Squads */}
              <div className="bg-slate-800/60 p-8 rounded-[2rem] border-2 border-slate-700/50">
                <h3 className="text-lg font-black text-emerald-400 uppercase tracking-wider mb-6">
                  🏆 Easiest Enemy Squads (3+ reports)
                </h3>
                <div className="space-y-4">
                  {stats.squadWinRates.map(
                    ({ enemyIds, success, fail, winRate }, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900/40 p-4 rounded-xl border border-emerald-500/20"
                      >
                        <div className="flex flex-wrap gap-2 mb-2">
                          {enemyIds.map((id) => {
                            const hero = getHero(id);
                            return hero ? (
                              <span
                                key={id}
                                className="text-xs font-bold px-2 py-1 bg-slate-700 text-slate-300 rounded-lg"
                              >
                                {hero.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-slate-400">
                            {success}W - {fail}L
                          </div>
                          <div className="text-emerald-400 font-black text-lg">
                            {(winRate * 100).toFixed(0)}% Win Rate
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Lowest Win Rate Squads */}
              <div className="bg-slate-800/60 p-8 rounded-[2rem] border-2 border-slate-700/50">
                <h3 className="text-lg font-black text-rose-400 uppercase tracking-wider mb-6">
                  ⚠️ Hardest Enemy Squads (3+ reports)
                </h3>
                <div className="space-y-4">
                  {stats.squadLossRates.map(
                    ({ enemyIds, success, fail, lossRate }, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900/40 p-4 rounded-xl border border-rose-500/20"
                      >
                        <div className="flex flex-wrap gap-2 mb-2">
                          {enemyIds.map((id) => {
                            const hero = getHero(id);
                            return hero ? (
                              <span
                                key={id}
                                className="text-xs font-bold px-2 py-1 bg-slate-700 text-slate-300 rounded-lg"
                              >
                                {hero.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-slate-400">
                            {success}W - {fail}L
                          </div>
                          <div className="text-rose-400 font-black text-lg">
                            {(lossRate * 100).toFixed(0)}% Loss Rate
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-32 py-12 border-t-2 border-slate-800/80 text-center">
        <div className="flex justify-center gap-8 mb-6 opacity-20 grayscale">
          {/* Mock Brand/Guild Logos can go here */}
          <div className="w-10 h-10 bg-white rounded-full"></div>
          <div className="w-10 h-10 bg-white rounded-full"></div>
          <div className="w-10 h-10 bg-white rounded-full"></div>
        </div>
        <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.4em]">
          Classified Intelligence Protocol &copy; 2024 Rebirth Alliance
        </p>
      </footer>
    </div>
  );
};

export default App;
