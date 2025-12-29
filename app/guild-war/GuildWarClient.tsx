"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { getSupabaseBrowserClient } from "@/lib/supabase/browserClient";
import { War, WarPerformance } from "@/types";
import { calculateStats, MemberStats } from "./utils";

type Tab = "input" | "history" | "stats";

export default function GuildWarClient() {
  const [activeTab, setActiveTab] = useState<Tab>("history");
  const [loading, setLoading] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authDisplayName, setAuthDisplayName] = useState<string | null>(null);
  const [csvInput, setCsvInput] = useState("");
  const [parseResult, setParseResult] = useState<{
    opponent: string;
    performances: Omit<WarPerformance, "id" | "war_id" | "created_at">[];
  } | null>(null);

  const [wars, setWars] = useState<War[]>([]);
  const [allPerformances, setAllPerformances] = useState<WarPerformance[]>([]);
  const [stats, setStats] = useState<MemberStats[]>([]);

  const [selectedWar, setSelectedWar] = useState<War | null>(null);
  const [selectedWarPerformances, setSelectedWarPerformances] = useState<WarPerformance[]>([]);
  const [canEdit, setCanEdit] = useState(false);

  const supabase = getSupabaseBrowserClient();

  const fetchData = useCallback(async () => {
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setAuthEmail(user?.email ?? null);
    const ingameName =
      typeof user?.user_metadata?.ingame_name === "string"
        ? (user.user_metadata.ingame_name as string)
        : null;
    setAuthDisplayName(
      ingameName || (user?.email ? user.email.split("@")[0] : null)
    );

    const allowedEditors = new Set(["Icewind", "UnknownSnow"]);
    const ok = Boolean(ingameName && allowedEditors.has(ingameName));
    setCanEdit(ok);
    if (!ok) {
      setActiveTab((prev) => (prev === "input" ? "history" : prev));
    }

    const { data: warsData } = await supabase
      .from("wars")
      .select("*")
      .order("created_at", { ascending: false });
    if (warsData) setWars(warsData);

    const { data: perfData } = await supabase.from("war_performances").select("*");
    if (perfData) {
      setAllPerformances(perfData);
      setStats(calculateStats(perfData));
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthEmail(null);
    setAuthDisplayName(null);
    setCanEdit(false);
    setActiveTab("history");
  };

  const handleWarClick = (war: War) => {
    setSelectedWar(war);
    const perfs = allPerformances.filter((p) => p.war_id === war.id);
    setSelectedWarPerformances(perfs);
  };

  const parseCSV = (input: string) => {
    const lines = input.trim().split("\n");
    if (lines.length < 2) return;

    const firstLine = lines[0].trim();
    const headerParts = firstLine.split(/\t+/);
    let opponent = "Unknown Opponent";
    if (headerParts.length > 0) {
      opponent = headerParts[0]
        .replace("ATK Record", "")
        .replace("DEF W", "")
        .trim();
    }

    const performances: Omit<WarPerformance, "id" | "war_id" | "created_at">[] = [];

    let startIndex = 0;
    if (lines[0].includes("ATK Record")) startIndex = 1;
    if (lines[1] && !lines[1].trim()) startIndex = 2;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(/\t+/);
      if (parts.length < 3) continue;

      const name = parts[0].trim();
      const record = parts[1].trim();
      const defWins = parseInt(parts[2].trim()) || 0;

      const [winsStr, lossesStr] = record.split("-");
      const wins = parseInt(winsStr) || 0;
      const losses = parseInt(lossesStr) || 0;

      if (name) {
        performances.push({
          member_name: name,
          wins,
          losses,
          defense_wins: defWins,
        });
      }
    }

    setParseResult({ opponent, performances });
  };

  const handleSubmit = async () => {
    if (!parseResult || !supabase) return;
    setLoading(true);

    try {
      const { data: warData, error: warError } = await supabase
        .from("wars")
        .insert({ opponent_name: parseResult.opponent })
        .select()
        .single();

      if (warError) throw warError;

      const performancesToInsert = parseResult.performances.map((p) => ({
        war_id: warData.id,
        member_name: p.member_name,
        wins: p.wins,
        losses: p.losses,
        defense_wins: p.defense_wins,
      }));

      const { error: perfError } = await supabase
        .from("war_performances")
        .insert(performancesToInsert);

      if (perfError) throw perfError;

      alert("War data saved successfully!");
      setCsvInput("");
      setParseResult(null);
      fetchData(); // Refresh data
      setActiveTab("history");
    } catch (error) {
      console.error("Error saving data:", error);
      alert("Failed to save data.");
    } finally {
      setLoading(false);
    }
  };

  const renderTier = (tier: "Top" | "Mid" | "Low", title: string, colorClass: string) => {
    const tierStats = stats.filter((s) => s.tier === tier);
    if (tierStats.length === 0) return null;

    return (
      <div className="mb-8">
        <h3 className={`text-xl font-bold mb-4 text-center ${colorClass} uppercase tracking-wider`}>
          {title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tierStats.map((s) => (
            <div
              key={s.member_name}
              className={`relative overflow-hidden rounded-xl border p-4 transition-all hover:scale-105 ${
                tier === "Top"
                  ? "bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-500/50 shadow-lg shadow-blue-900/20"
                  : tier === "Mid"
                  ? "bg-gray-800/40 border-gray-700"
                  : "bg-red-900/20 border-red-900/30"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-lg text-white">{s.member_name}</span>
                <div className="flex flex-col items-end">
                   <span className="text-xs font-mono text-gray-400">WR: {s.win_rate.toFixed(0)}%</span>
                   <span className="text-xs font-mono text-gray-400">DW: {s.total_def_wins}</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-3">
                {s.titles.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-white/10 text-white/80 border border-white/10"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs border-t border-white/10 pt-2">
                 <div>
                    <div className="text-gray-400">Record</div>
                    <div className="font-bold text-white">{s.total_wins}W - {s.total_losses}L</div>
                 </div>
                 <div>
                    <div className="text-gray-400">Def Wins</div>
                    <div className="font-bold text-blue-400">{s.total_def_wins}</div>
                 </div>
                 <div>
                    <div className="text-gray-400">Wars</div>
                    <div className="font-bold text-white">{s.total_wars}</div>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Navbar (matches main site) */}
      <nav className="border-b border-white/10 bg-slate-950/35 glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/90 rounded-xl flex items-center justify-center shadow-lg rotate-3">
              <svg
                className="w-6 h-6 text-white"
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
            <div>
              <h1 className="text-lg font-black tracking-tight text-white uppercase leading-none">
                Rebirth GW Intel
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Seven Knights Intelligence
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/counter-quiz"
              className="px-4 py-2 bg-slate-900/30 glass hover:bg-slate-900/45 text-slate-200 hover:text-white font-bold text-sm rounded-xl border border-white/10 transition-all flex items-center gap-2"
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
                  d="M7 7h10M7 12h10M7 17h10"
                />
              </svg>
              <span className="hidden sm:inline">Counter Quiz</span>
              <span className="sm:hidden">Quiz</span>
            </Link>

            <Link
              href="/guild-war"
              className="px-4 py-2 bg-blue-500/15 glass border border-blue-500/25 text-blue-200 font-bold text-sm rounded-xl transition-all flex items-center gap-2"
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
                  d="M7 7h10M7 12h10M7 17h10"
                />
              </svg>
              <span className="hidden sm:inline">Guild War</span>
              <span className="sm:hidden">GW</span>
            </Link>

            {authEmail ? (
              <>
                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-900/30 glass rounded-xl border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span className="text-sm text-slate-300 font-semibold">
                    {authDisplayName ?? authEmail.split("@")[0]}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 bg-slate-900/30 glass hover:bg-slate-900/45 text-slate-200 hover:text-white font-bold text-sm rounded-xl border border-white/10 transition-all flex items-center gap-2"
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
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-4 py-2 bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2"
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
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
        <AuthModal open={authModalOpen} reason="generic" onClose={() => setAuthModalOpen(false)} />

        <div className="mb-10 p-10 rounded-3xl border border-white/10 bg-slate-950/25 glass text-slate-300">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white">
            Guild War Tracker
          </h2>
          <p className="text-slate-400 font-semibold mt-2">
            Store wars and view performance intel across all wars.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b-2 border-slate-700/50 mb-8">
          {(["input", "history", "stats"] as Tab[]).map((tab) => {
            if (tab === "input" && !canEdit) return null;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-8 py-4 font-black text-sm uppercase tracking-wider transition-all relative ${
                  activeTab === tab
                    ? "text-blue-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:bg-blue-500 after:rounded-t-full"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="relative z-10 isolate bg-slate-900/60 glass p-6 md:p-8 rounded-[2rem] border-2 border-white/10 shadow-xl">
          {activeTab === "input" && canEdit && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <label className="block text-sm font-black text-slate-400 mb-3 uppercase tracking-wide">
                  Paste War Data (CSV)
                </label>
                <textarea
                  value={csvInput}
                  onChange={(e) => {
                    setCsvInput(e.target.value);
                    parseCSV(e.target.value);
                  }}
                  className="w-full h-48 bg-slate-900/35 glass border border-white/10 rounded-xl p-4 font-mono text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  placeholder={`Myth vs Spartan\tATK Record\tDEF W\n\naeki\t5-0\t2\nalex2k\t2-3\t2\n...`}
                />
              </div>

              {parseResult && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row items-center justify-between bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <span className="text-gray-400 text-sm font-bold uppercase">Opponent:</span>
                      <input
                        type="text"
                        value={parseResult.opponent}
                        onChange={(e) =>
                          setParseResult({ ...parseResult, opponent: e.target.value })
                        }
                        className="bg-transparent border-b-2 border-gray-600 focus:border-yellow-500 focus:outline-none font-bold text-2xl text-white w-full md:w-auto"
                      />
                    </div>
                    <div className="mt-4 md:mt-0 px-4 py-2 bg-blue-900/30 text-blue-400 rounded-full text-sm font-bold border border-blue-500/30">
                      {parseResult.performances.length} Members Parsed
                    </div>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto border border-gray-800 rounded-xl custom-scrollbar">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-900 text-gray-400 sticky top-0 z-10">
                        <tr>
                          <th className="p-4 font-bold uppercase text-xs tracking-wider">Member</th>
                          <th className="p-4 font-bold uppercase text-xs tracking-wider">Wins</th>
                          <th className="p-4 font-bold uppercase text-xs tracking-wider">Losses</th>
                          <th className="p-4 font-bold uppercase text-xs tracking-wider">Def Wins</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 bg-gray-900/20">
                        {parseResult.performances.map((p, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 font-bold text-white">{p.member_name}</td>
                            <td className="p-4 text-green-400 font-mono font-bold">{p.wins}</td>
                            <td className="p-4 text-red-400 font-mono font-bold">{p.losses}</td>
                            <td className="p-4 text-blue-400 font-mono font-bold">{p.defense_wins}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-orange-900/40 transition-all transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {loading ? "Saving War Data..." : "CONFIRM & SAVE WAR DATA"}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {selectedWar ? (
                <div>
                  <button
                    onClick={() => setSelectedWar(null)}
                    className="mb-6 flex items-center gap-2 text-yellow-500 hover:text-yellow-400 font-bold transition-colors"
                  >
                    <span>&larr;</span> Back to History
                  </button>
                  <div className="flex items-baseline gap-4 mb-6">
                    <h2 className="text-3xl font-bold text-white">
                      {selectedWar.opponent_name}
                    </h2>
                    <span className="text-gray-500 text-lg">
                      {new Date(selectedWar.war_date).toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="max-h-[600px] overflow-y-auto border border-gray-800 rounded-xl custom-scrollbar">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-900 text-gray-400 sticky top-0 z-10">
                        <tr>
                          <th className="p-4 font-bold uppercase text-xs tracking-wider">
                            Member
                          </th>
                          <th className="p-4 font-bold uppercase text-xs tracking-wider">
                            Wins
                          </th>
                          <th className="p-4 font-bold uppercase text-xs tracking-wider">
                            Losses
                          </th>
                          <th className="p-4 font-bold uppercase text-xs tracking-wider">
                            Def Wins
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 bg-gray-900/20">
                        {selectedWarPerformances.map((p) => (
                          <tr key={p.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 font-bold text-white">{p.member_name}</td>
                            <td className="p-4 text-green-400 font-mono font-bold">
                              {p.wins}
                            </td>
                            <td className="p-4 text-red-400 font-mono font-bold">
                              {p.losses}
                            </td>
                            <td className="p-4 text-blue-400 font-mono font-bold">
                              {p.defense_wins}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-6 text-gray-200">War History</h2>
                  {wars.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                      No wars recorded yet.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {wars.map((war) => (
                        <div
                          key={war.id}
                          onClick={() => handleWarClick(war)}
                          className="bg-gray-800/40 border border-gray-700 p-6 rounded-xl hover:bg-gray-800/60 transition-colors cursor-pointer group"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="text-xl font-bold text-white group-hover:text-yellow-500 transition-colors">
                                {war.opponent_name}
                              </h3>
                              <p className="text-sm text-gray-400 mt-1">
                                {new Date(war.war_date).toLocaleDateString(undefined, {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-300">
                                View Details &rarr;
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "stats" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-white mb-2">Member Performance</h2>
                <p className="text-gray-400">Cumulative statistics across all recorded wars</p>
              </div>
              
              {renderTier("Top", "Top Performers (Excellent)", "text-blue-400")}
              {renderTier("Mid", "Mid-Tier Performance", "text-green-400")}
              {renderTier("Low", "Needs Improvement", "text-red-400")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
