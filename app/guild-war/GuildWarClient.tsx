"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import AuthModal from "@/components/AuthModal";
import ConfirmModal from "@/components/ConfirmModal";
import { getSupabaseBrowserClient } from "@/lib/supabase/browserClient";
import { War, WarPerformance } from "@/types";
import { calculateStats, MemberStats } from "./utils";

type Tab = "input" | "history" | "stats" | "leaders" | "admin";

export default function GuildWarClient() {
  const [activeTab, setActiveTab] = useState<Tab>("history");
  const [loading, setLoading] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authDisplayName, setAuthDisplayName] = useState<string | null>(null);
  const [isLocalhost, setIsLocalhost] = useState(false);
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
  const [selectedWarStats, setSelectedWarStats] = useState<MemberStats[]>([]);
  const [isEditingWar, setIsEditingWar] = useState(false);
  const [editText, setEditText] = useState("");
  const [editParseResult, setEditParseResult] = useState<{
    opponent: string;
    performances: Omit<WarPerformance, "id" | "war_id" | "created_at">[];
  } | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const [memberToDelete, setMemberToDelete] = useState<MemberStats | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState(false);

  const supabase = getSupabaseBrowserClient();

  const normalizeMemberDisplayName = (name: string) => name.trim().replace(/\s+/g, " ");
  const memberKey = (name: string) => normalizeMemberDisplayName(name).toLowerCase();

  const winRateColor = (wr: number) => {
    if (wr >= 85) return "text-emerald-400";
    if (wr >= 70) return "text-teal-300";
    if (wr >= 55) return "text-blue-300";
    if (wr >= 40) return "text-yellow-300";
    if (wr >= 25) return "text-orange-300";
    return "text-rose-400";
  };

  const pickMostCommonName = (counts: Map<string, number>) => {
    const entries = Array.from(counts.entries());
    if (entries.length === 0) return "";
    entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { sensitivity: "base" }));
    return entries[0][0];
  };

  const aggregateWarPerformances = (warId: string, perfs: WarPerformance[]): WarPerformance[] => {
    const map = new Map<
      string,
      {
        wins: number;
        losses: number;
        defense_wins: number;
        nameCounts: Map<string, number>;
      }
    >();

    perfs.forEach((p) => {
      const displayName = normalizeMemberDisplayName(p.member_name ?? "");
      if (!displayName) return;
      const key = memberKey(displayName);
      const current =
        map.get(key) || { wins: 0, losses: 0, defense_wins: 0, nameCounts: new Map<string, number>() };
      current.wins += p.wins;
      current.losses += p.losses;
      current.defense_wins += p.defense_wins;
      current.nameCounts.set(displayName, (current.nameCounts.get(displayName) ?? 0) + 1);
      map.set(key, current);
    });

    const now = new Date().toISOString();
    return Array.from(map.entries())
      .map(([key, v]) => ({
        id: `${warId}:${key}`,
        war_id: warId,
        member_name: pickMostCommonName(v.nameCounts) || key,
        wins: v.wins,
        losses: v.losses,
        defense_wins: v.defense_wins,
        created_at: now,
      }))
      .sort((a, b) => a.member_name.localeCompare(b.member_name));
  };

  const makeWarTiersMoreGenerous = (warStats: MemberStats[]): MemberStats[] => {
    const ranked = warStats
      .slice()
      .sort((a, b) => {
        // Per-war ranking: WR -> wins -> def wins -> losses (lower better)
        return (
          b.win_rate - a.win_rate ||
          b.total_wins - a.total_wins ||
          b.total_def_wins - a.total_def_wins ||
          a.total_losses - b.total_losses ||
          a.member_name.localeCompare(b.member_name)
        );
      });

    const n = ranked.length;
    if (n === 0) return warStats;
    if (n <= 4) {
      return ranked.map((s) => ({ ...s, tier: "Top" }));
    }

    let topCount = Math.max(3, Math.ceil(n * 0.45));
    let lowCount = Math.max(1, Math.floor(n * 0.2));
    topCount = Math.min(n, topCount);
    if (topCount + lowCount > n) {
      lowCount = Math.max(0, n - topCount);
    }

    const topSet = new Set(ranked.slice(0, topCount).map((s) => s.member_name));
    const lowSet = new Set(ranked.slice(n - lowCount).map((s) => s.member_name));

    return warStats.map((s) => {
      if (topSet.has(s.member_name)) return { ...s, tier: "Top" };
      if (lowSet.has(s.member_name)) return { ...s, tier: "Low" };
      return { ...s, tier: "Mid" };
    });
  };

  const isLocalDevHost = () => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  };

  useEffect(() => {
    setIsLocalhost(isLocalDevHost());
  }, []);

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
    const ok = isLocalDevHost() || Boolean(ingameName && allowedEditors.has(ingameName));
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
    const ok = isLocalDevHost();
    setCanEdit(ok);
    setActiveTab("history");
  };

  const parseWarText = (
    input: string
  ): {
    opponent: string;
    performances: Omit<WarPerformance, "id" | "war_id" | "created_at">[];
  } | null => {
    const lines = input.trim().split("\n");
    if (lines.length < 2) return null;

    const firstLine = lines[0].trim();
    const headerParts = firstLine.split(/\t+/);
    let opponent = "Unknown Opponent";
    if (headerParts.length > 0) {
      opponent = headerParts[0]
        .replace("ATK Record", "")
        .replace("DEF W", "")
        .trim();
    }

    const perfMap = new Map<
      string,
      {
        member_name: string;
        wins: number;
        losses: number;
        defense_wins: number;
        nameCounts: Map<string, number>;
      }
    >();

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

      const displayName = normalizeMemberDisplayName(name);
      if (!displayName) continue;
      const key = memberKey(displayName);
      const current =
        perfMap.get(key) ||
        {
          member_name: displayName,
          wins: 0,
          losses: 0,
          defense_wins: 0,
          nameCounts: new Map<string, number>(),
        };
      current.wins += wins;
      current.losses += losses;
      current.defense_wins += defWins;
      current.nameCounts.set(displayName, (current.nameCounts.get(displayName) ?? 0) + 1);
      current.member_name = pickMostCommonName(current.nameCounts) || current.member_name;
      perfMap.set(key, current);
    }

    const performances: Omit<WarPerformance, "id" | "war_id" | "created_at">[] = Array.from(
      perfMap.values()
    )
      .map((p) => ({
        member_name: normalizeMemberDisplayName(p.member_name),
        wins: p.wins,
        losses: p.losses,
        defense_wins: p.defense_wins,
      }))
      .sort((a, b) => a.member_name.localeCompare(b.member_name));

    return { opponent, performances };
  };

  const handleWarClick = (war: War) => {
    setSelectedWar(war);
    const perfsRaw = allPerformances.filter((p) => p.war_id === war.id);
    const perfs = aggregateWarPerformances(war.id, perfsRaw);
    setSelectedWarPerformances(perfs);
    setSelectedWarStats(makeWarTiersMoreGenerous(calculateStats(perfs)));
    setIsEditingWar(false);
    setEditText("");
    setEditParseResult(null);
  };

  const parseCSV = (input: string) => {
    const parsed = parseWarText(input);
    if (!parsed) return;
    setParseResult(parsed);
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
        member_name: normalizeMemberDisplayName(p.member_name),
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

  const warToTSV = (war: War, perfs: WarPerformance[]) => {
    const header = `${war.opponent_name}\tATK Record\tDEF W`;
    const rows = perfs
      .slice()
      .sort((a, b) => a.member_name.localeCompare(b.member_name))
      .map((p) => `${p.member_name}\t${p.wins}-${p.losses}\t${p.defense_wins}`)
      .join("\n");
    return `${header}\n\n${rows}`;
  };

  const beginEditSelectedWar = () => {
    if (!canEdit || !selectedWar) return;
    setIsEditingWar(true);
    const text = warToTSV(selectedWar, selectedWarPerformances);
    setEditText(text);
    const parsed = parseWarText(text);
    setEditParseResult(parsed);
  };

  const saveSelectedWarEdits = async () => {
    if (!supabase || !selectedWar || !editParseResult) return;
    setLoading(true);

    try {
      const { error: warUpdateError } = await supabase
        .from("wars")
        .update({ opponent_name: editParseResult.opponent })
        .eq("id", selectedWar.id);
      if (warUpdateError) throw warUpdateError;

      const { error: deleteError } = await supabase
        .from("war_performances")
        .delete()
        .eq("war_id", selectedWar.id);
      if (deleteError) throw deleteError;

      const performancesToInsert = editParseResult.performances.map((p) => ({
        war_id: selectedWar.id,
        member_name: normalizeMemberDisplayName(p.member_name),
        wins: p.wins,
        losses: p.losses,
        defense_wins: p.defense_wins,
      }));

      const { error: insertError } = await supabase
        .from("war_performances")
        .insert(performancesToInsert);
      if (insertError) throw insertError;

      setIsEditingWar(false);
      setEditText("");
      setEditParseResult(null);
      await fetchData();

      // Refresh selected war view
      const updatedWar: War = { ...selectedWar, opponent_name: editParseResult.opponent };
      setSelectedWar(updatedWar);
      const updatedPerfs = performancesToInsert.map((p, idx) => ({
        id: `${idx}`,
        war_id: p.war_id,
        member_name: p.member_name,
        wins: p.wins,
        losses: p.losses,
        defense_wins: p.defense_wins,
        created_at: new Date().toISOString(),
      }));
      setSelectedWarPerformances(updatedPerfs);
      setSelectedWarStats(makeWarTiersMoreGenerous(calculateStats(updatedPerfs)));
      alert("War updated successfully!");
    } catch (error) {
      console.error("Error updating war:", error);
      alert("Failed to update war.");
    } finally {
      setLoading(false);
    }
  };

  const requestDeleteMember = (member: MemberStats) => {
    if (!canEdit) return;
    setMemberToDelete(member);
    setConfirmDeleteOpen(true);
  };

  const confirmDeleteMember = async () => {
    if (!supabase || !memberToDelete) return;
    setDeletingMember(true);
    try {
      const target = memberKey(memberToDelete.member_name);
      const { data: rows, error: fetchError } = await supabase
        .from("war_performances")
        .select("id, member_name");
      if (fetchError) throw fetchError;

      const ids = (rows ?? [])
        .filter((r) => memberKey((r as { member_name: string }).member_name ?? "") === target)
        .map((r) => (r as { id: string }).id)
        .filter(Boolean);

      if (ids.length === 0) {
        alert(`No rows found for ${memberToDelete.member_name}.`);
      } else {
        const chunkSize = 500;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { error } = await supabase.from("war_performances").delete().in("id", chunk);
          if (error) throw error;
        }
      }

      await fetchData();
      setSelectedWar(null);
      alert(`Deleted ${memberToDelete.member_name} from all Guild War reports.`);
    } catch (error) {
      console.error("Error deleting member:", error);
      alert("Failed to delete member.");
    } finally {
      setDeletingMember(false);
      setConfirmDeleteOpen(false);
      setMemberToDelete(null);
    }
  };

  const renderTier = (
    sourceStats: MemberStats[],
    tier: "Top" | "Mid" | "Low",
    title: string,
    colorClass: string
  ) => {
    const tierStats = sourceStats
      .filter((s) => s.tier === tier)
      .slice()
      .sort((a, b) => {
        // Rank strongest first: WR -> wins -> def wins -> wars -> name
        return (
          b.win_rate - a.win_rate ||
          b.total_wins - a.total_wins ||
          b.total_def_wins - a.total_def_wins ||
          b.total_wars - a.total_wars ||
          a.member_name.localeCompare(b.member_name)
        );
      });
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
                   {(() => {
                     const standoutWr = s.win_rate >= 90 || (s.total_wins + s.total_losses >= 10 && s.win_rate <= 30);
                     const standoutDw = s.total_def_wins >= 15;
                     return (
                       <>
                         <span
                           className={`${standoutWr ? "text-sm md:text-base" : "text-xs"} font-mono font-black ${winRateColor(
                             s.win_rate
                           )}`}
                         >
                           WR: {s.win_rate.toFixed(0)}%
                         </span>
                         <span
                           className={`${standoutDw ? "text-sm md:text-base" : "text-xs"} font-mono font-black ${
                             standoutDw ? "text-sky-300" : "text-gray-400"
                           }`}
                         >
                           DW: {s.total_def_wins}
                         </span>
                       </>
                     );
                   })()}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {s.titles.map((t) => {
                  const titleBase =
                    "px-3 py-1.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider border-2 shadow-lg";

                  const titleStyle =
                    t === "Unbeaten Attacker"
                      ? "bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 border-emerald-500/30 text-emerald-200 italic"
                      : t === "Fortress Defense"
                      ? "bg-gradient-to-r from-teal-500/20 to-emerald-500/10 border-emerald-500/25 text-emerald-100 italic"
                      : t === "Balanced Defender"
                      ? "bg-gradient-to-r from-blue-500/18 to-teal-500/10 border-blue-500/25 text-blue-100 italic"
                      : t === "Strong Contributor"
                      ? "bg-gradient-to-r from-teal-500/18 to-blue-500/10 border-teal-500/20 text-teal-100 italic"
                      : t === "Solid Defense"
                      ? "bg-gradient-to-r from-sky-500/18 to-teal-500/10 border-sky-500/20 text-sky-100 italic"
                      : t === "Needs Training"
                      ? "bg-gradient-to-r from-rose-500/20 to-rose-400/10 border-rose-500/30 text-rose-200"
                      : t === "Open Gate"
                      ? "bg-gradient-to-r from-orange-500/20 to-rose-500/10 border-orange-500/30 text-orange-100"
                      : t === "Elite Knight"
                      ? "bg-gradient-to-r from-teal-500/20 to-blue-500/10 border-teal-500/25 text-white italic"
                      : t === "Knight"
                      ? "bg-gradient-to-r from-blue-500/12 to-slate-500/10 border-blue-500/15 text-slate-100"
                      : t === "Recruit"
                      ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/10 border-yellow-500/30 text-yellow-100"
                      : "bg-white/10 border-white/10 text-white/90";

                  return (
                    <span key={t} className={`${titleBase} ${titleStyle}`}>
                      {t}
                    </span>
                  );
                })}
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

        <ConfirmModal
          open={confirmDeleteOpen}
          title="Remove Member From Reports"
          message={
            memberToDelete
              ? `This will permanently delete ALL Guild War rows for “${memberToDelete.member_name}”. This cannot be undone.`
              : "This will permanently delete ALL Guild War rows for this member. This cannot be undone."
          }
          confirmLabel={deletingMember ? "Deleting..." : "Delete Member"}
          cancelLabel="Cancel"
          tone="danger"
          onCancel={() => {
            if (deletingMember) return;
            setConfirmDeleteOpen(false);
            setMemberToDelete(null);
          }}
          onConfirm={() => {
            if (deletingMember) return;
            confirmDeleteMember();
          }}
        />

        <div className="mb-10 p-10 rounded-3xl border border-white/10 bg-slate-950/25 glass text-slate-300">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white italic uppercase leading-none">
            Guild War <span className="text-blue-500">Tracker</span>
          </h2>
          <p className="text-slate-400 font-semibold mt-2">
            Store wars and view performance intel across all wars.
          </p>
          {isLocalhost && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-slate-900/40 glass">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <div className="text-xs font-black uppercase tracking-widest text-slate-300">
                Localhost Admin Mode
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b-2 border-slate-700/50 mb-8">
          {(
            [
              { key: "history" as const, label: "Reports" },
              { key: "stats" as const, label: "Overall Report" },
              { key: "leaders" as const, label: "Stats" },
              { key: "input" as const, label: "Input", requiresEdit: true },
              { key: "admin" as const, label: "Admin Controls", requiresEdit: true },
            ] satisfies Array<{ key: Tab; label: string; requiresEdit?: boolean }>
          ).map(({ key, label, requiresEdit }) => {
            if (requiresEdit && !canEdit) return null;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-8 py-4 font-black text-sm uppercase tracking-wider transition-all relative ${
                  activeTab === key
                    ? "text-blue-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:bg-blue-500 after:rounded-t-full"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {label}
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
                    <span>&larr;</span> Back to Reports
                  </button>
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                    <div className="flex items-baseline gap-4 flex-wrap">
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

                    {canEdit ? (
                      <div className="flex gap-3">
                        {!isEditingWar ? (
                          <button
                            onClick={beginEditSelectedWar}
                            className="px-4 py-2 bg-slate-900/30 glass hover:bg-slate-900/45 text-slate-200 hover:text-white font-bold text-sm rounded-xl border border-white/10 transition-all"
                          >
                            Edit War CSV
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setIsEditingWar(false);
                                setEditText("");
                                setEditParseResult(null);
                              }}
                              className="px-4 py-2 bg-slate-900/30 glass hover:bg-slate-900/45 text-slate-200 hover:text-white font-bold text-sm rounded-xl border border-white/10 transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={saveSelectedWarEdits}
                              disabled={loading || !editParseResult}
                              className="px-4 py-2 bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loading ? "Saving..." : "Save Changes"}
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Per-war wowfactor stats */}
                  <div className="mb-10">
                    <div className="text-center mb-8">
                      <h3 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tight">
                        War <span className="text-emerald-400">Performance</span>
                      </h3>
                      <p className="text-slate-400 font-semibold">
                        Stats for this war only (not combined)
                      </p>
                    </div>

                    {renderTier(selectedWarStats, "Top", "Top Performers (Excellent)", "text-blue-400")}
                    {renderTier(selectedWarStats, "Mid", "Mid-Tier Performance", "text-emerald-400")}
                    {renderTier(selectedWarStats, "Low", "Needs Improvement", "text-rose-400")}
                  </div>

                  {isEditingWar ? (
                    <div className="space-y-4 mb-10">
                      <label className="block text-sm font-black text-slate-400 uppercase tracking-wide">
                        Edit War Data (paste TSV/CSV)
                      </label>
                      <textarea
                        value={editText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditText(val);
                          setEditParseResult(parseWarText(val));
                        }}
                        className="w-full h-64 bg-slate-900/35 glass border border-white/10 rounded-xl p-4 font-mono text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      />

                      {editParseResult ? (
                        <div className="p-4 rounded-2xl border border-white/10 bg-slate-950/25 glass text-slate-300 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            <div className="text-xs font-black uppercase tracking-wider text-slate-500">Opponent</div>
                            <div className="text-white font-black text-lg">{editParseResult.opponent}</div>
                          </div>
                          <div className="text-sm font-black text-slate-300">
                            {editParseResult.performances.length} members parsed
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 glass text-rose-200 text-sm font-black">
                          Could not parse. Ensure format is: Name, Record (W-L), Def Wins.
                        </div>
                      )}
                    </div>
                  ) : (
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
                  )}
                </div>
              ) : (
                <>
                  <h2 className="text-3xl md:text-4xl font-black mb-6 text-white italic uppercase tracking-tight">
                    Reports
                  </h2>
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
                <h2 className="text-4xl md:text-5xl font-black text-white italic uppercase tracking-tight mb-2">
                  Overall <span className="text-blue-400">Report</span>
                </h2>
                <p className="text-slate-400 font-semibold">
                  Cumulative wowfactor tiers across all recorded wars
                </p>
              </div>
              
              {renderTier(stats, "Top", "Top Performers (Excellent)", "text-blue-400")}
              {renderTier(stats, "Mid", "Mid-Tier Performance", "text-emerald-400")}
              {renderTier(stats, "Low", "Needs Improvement", "text-rose-400")}
            </div>
          )}

          {activeTab === "leaders" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
              <div className="text-center">
                <h2 className="text-4xl md:text-5xl font-black text-white italic uppercase tracking-tight mb-2">
                  Guild War <span className="text-yellow-500">Stats</span>
                </h2>
                <p className="text-slate-400 font-semibold">
                  High-signal rankings across all wars (attack, defense, consistency)
                </p>
              </div>

              {(() => {
                const totals = allPerformances.reduce(
                  (acc, p) => {
                    acc.wins += p.wins;
                    acc.losses += p.losses;
                    acc.defWins += p.defense_wins;
                    return acc;
                  },
                  { wins: 0, losses: 0, defWins: 0 }
                );
                const totalAttacks = totals.wins + totals.losses;
                const overallWR = totalAttacks > 0 ? (totals.wins / totalAttacks) * 100 : 0;

                const byWins = [...stats].sort((a, b) => b.total_wins - a.total_wins);
                const byDef = [...stats].sort((a, b) => b.total_def_wins - a.total_def_wins);
                const byWars = [...stats].sort((a, b) => b.total_wars - a.total_wars);
                const byWinRate = [...stats]
                  .filter((s) => s.total_wins + s.total_losses >= 10)
                  .sort((a, b) => b.win_rate - a.win_rate || b.total_wins - a.total_wins);
                const byAvgDef = [...stats]
                  .filter((s) => s.total_wars >= 3)
                  .sort((a, b) => b.avg_def_wins - a.avg_def_wins || b.total_def_wins - a.total_def_wins);

                const byMostLosses = [...stats].sort((a, b) => b.total_losses - a.total_losses);
                const byWorstWinRate = [...stats]
                  .filter((s) => s.total_wins + s.total_losses >= 10)
                  .sort((a, b) => a.win_rate - b.win_rate || b.total_losses - a.total_losses);
                const byWorstAvgDef = [...stats]
                  .filter((s) => s.total_wars >= 3)
                  .sort((a, b) => a.avg_def_wins - b.avg_def_wins || a.total_def_wins - b.total_def_wins);
                const openGates = [...stats]
                  .filter((s) => s.total_wars >= 3 && s.total_def_wins === 0)
                  .sort((a, b) => b.total_wars - a.total_wars);

                const byMvp = [...stats]
                  .map((s) => {
                    const score = s.total_wins * 2 + s.total_def_wins - s.total_losses;
                    return { ...s, _score: score } as MemberStats & { _score: number };
                  })
                  .sort((a, b) => b._score - a._score);

                const perfect = [...stats]
                  .filter((s) => s.win_rate === 100 && s.total_wins >= 5)
                  .sort((a, b) => b.total_wins - a.total_wins);

                const renderTopList = (
                  title: string,
                  subtitle: string,
                  rows: Array<{
                    key: string;
                    primary: string;
                    secondary: string;
                    right: ReactNode;
                  }>
                ) => (
                  <div className="relative overflow-hidden bg-slate-950/15 glass p-6 md:p-8 rounded-[2rem] border-2 border-white/10">
                    <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl" />
                    <div className="mb-6">
                      <h3 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tight">
                        {title}
                      </h3>
                      <p className="text-slate-400 font-semibold mt-1">{subtitle}</p>
                    </div>
                    {rows.length === 0 ? (
                      <div className="text-slate-500 font-semibold">Not enough data yet.</div>
                    ) : (
                      <div className="divide-y divide-white/10">
                        {rows.slice(0, 10).map((r, idx) => (
                          <div
                            key={r.key}
                            className={`py-3 flex items-center justify-between gap-4 ${
                              idx === 0 ? "bg-white/5 rounded-2xl px-3" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-slate-900/60 glass border border-white/10 flex items-center justify-center font-black text-white">
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <div className={`${idx === 0 ? "text-lg" : ""} font-black text-white truncate`}>
                                  {r.primary}
                                </div>
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 truncate">
                                  {r.secondary}
                                </div>
                              </div>
                            </div>
                            <div className={`${idx === 0 ? "text-lg" : ""} text-right font-black text-white whitespace-nowrap`}>
                              {r.right}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );

                return (
                  <>
                    <div className="relative overflow-hidden bg-slate-950/15 glass border-2 border-white/10 rounded-[2rem] p-6 md:p-10">
                      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-yellow-500/10 blur-3xl" />
                      <div className="pointer-events-none absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-blue-500/10 blur-3xl" />
                      <div className="relative grid grid-cols-2 md:grid-cols-6 gap-4">
                      <div className="bg-slate-900/60 glass border-2 border-white/10 rounded-2xl p-5 text-center">
                        <div className="text-3xl font-black text-blue-400">{wars.length}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Wars</div>
                      </div>
                      <div className="bg-slate-900/60 glass border-2 border-white/10 rounded-2xl p-5 text-center">
                        <div className="text-3xl font-black text-emerald-400">{stats.length}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Members</div>
                      </div>
                      <div className="bg-slate-900/60 glass border-2 border-white/10 rounded-2xl p-5 text-center">
                        <div className="text-3xl font-black text-white">{totalAttacks}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Total Attacks</div>
                      </div>
                      <div className="bg-slate-900/60 glass border-2 border-white/10 rounded-2xl p-5 text-center">
                        <div className="text-3xl font-black text-green-400">{totals.wins}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Wins</div>
                      </div>
                      <div className="bg-slate-900/60 glass border-2 border-white/10 rounded-2xl p-5 text-center">
                        <div className="text-3xl font-black text-rose-400">{totals.losses}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Losses</div>
                      </div>
                      <div className="bg-slate-900/60 glass border-2 border-white/10 rounded-2xl p-5 text-center">
                        <div className={`text-3xl font-black ${winRateColor(overallWR)}`}>{overallWR.toFixed(0)}%</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Overall WR</div>
                      </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {renderTopList(
                        "Top Attackers",
                        "Most wins across all wars",
                        byWins.map((s) => ({
                          key: s.member_name,
                          primary: s.member_name,
                          secondary: `${s.total_wins + s.total_losses} attacks • ${s.win_rate.toFixed(0)}% WR`,
                          right: `${s.total_wins}W`,
                        }))
                      )}

                      {renderTopList(
                        "Top Defenders",
                        "Most defense wins across all wars",
                        byDef.map((s) => ({
                          key: s.member_name,
                          primary: s.member_name,
                          secondary: `${s.total_wars} wars • ${s.avg_def_wins.toFixed(1)} avg DW`,
                          right: `${s.total_def_wins} DW`,
                        }))
                      )}

                      {renderTopList(
                        "Sharpshooters",
                        "Best win rate (min 10 attacks)",
                        byWinRate.map((s) => ({
                          key: s.member_name,
                          primary: s.member_name,
                          secondary: `${s.total_wins}-${s.total_losses} record`,
                          right: (
                            <span className={winRateColor(s.win_rate)}>
                              {s.win_rate.toFixed(0)}% WR
                            </span>
                          ),
                        }))
                      )}

                      {renderTopList(
                        "War Veterans",
                        "Most wars recorded",
                        byWars.map((s) => ({
                          key: s.member_name,
                          primary: s.member_name,
                          secondary: `${s.total_wins + s.total_losses} attacks • ${s.win_rate.toFixed(0)}% WR`,
                          right: `${s.total_wars} wars`,
                        }))
                      )}

                      {renderTopList(
                        "Iron Walls",
                        "Best average defense wins (min 3 wars)",
                        byAvgDef.map((s) => ({
                          key: s.member_name,
                          primary: s.member_name,
                          secondary: `${s.total_def_wins} total DW • ${s.total_wars} wars`,
                          right: `${s.avg_def_wins.toFixed(1)} avg DW`,
                        }))
                      )}

                      {renderTopList(
                        "MVP Score",
                        "Score = Wins×2 + DefWins − Losses",
                        byMvp.map((s) => {
                          const score = (s as MemberStats & { _score: number })._score;
                          return {
                            key: s.member_name,
                            primary: s.member_name,
                            secondary: `${s.total_wins}W • ${s.total_def_wins} DW • ${s.total_losses}L`,
                            right: `${score}`,
                          };
                        })
                      )}

                      {renderTopList(
                        "Needs Training",
                        "Worst win rate (min 10 attacks)",
                        byWorstWinRate.map((s) => ({
                          key: s.member_name,
                          primary: s.member_name,
                          secondary: `${s.total_wins}-${s.total_losses} record • ${s.total_wins + s.total_losses} attacks`,
                          right: (
                            <span className={winRateColor(s.win_rate)}>
                              {s.win_rate.toFixed(0)}% WR
                            </span>
                          ),
                        }))
                      )}

                      {renderTopList(
                        "Most Losses",
                        "Highest total losses across all wars",
                        byMostLosses.map((s) => ({
                          key: s.member_name,
                          primary: s.member_name,
                          secondary: `${s.total_wins + s.total_losses} attacks • ${s.win_rate.toFixed(0)}% WR`,
                          right: <span className="text-rose-300">{s.total_losses}L</span>,
                        }))
                      )}

                      {renderTopList(
                        "Defense Liability",
                        "Lowest average defense wins (min 3 wars)",
                        byWorstAvgDef.map((s) => ({
                          key: s.member_name,
                          primary: s.member_name,
                          secondary: `${s.total_def_wins} total DW • ${s.total_wars} wars`,
                          right: `${s.avg_def_wins.toFixed(1)} avg DW`,
                        }))
                      )}

                      {renderTopList(
                        "Open Gates",
                        "0 defense wins (min 3 wars)",
                        openGates.map((s) => ({
                          key: s.member_name,
                          primary: s.member_name,
                          secondary: `${s.total_wars} wars recorded`,
                          right: "0 DW",
                        }))
                      )}
                    </div>

                    {perfect.length > 0 ? (
                      <div className="bg-slate-950/15 glass p-6 md:p-8 rounded-[2rem] border-2 border-white/10">
                        <h3 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tight">
                          Perfect <span className="text-emerald-400">Warriors</span>
                        </h3>
                        <p className="text-slate-400 font-semibold mt-1">100% win rate (min 5 wins)</p>
                        <div className="mt-6 flex flex-wrap gap-3">
                          {perfect.map((s) => (
                            <div
                              key={s.member_name}
                              className="px-4 py-2 rounded-xl border border-white/10 bg-slate-900/40 glass"
                            >
                              <div className="font-black text-white">{s.member_name}</div>
                              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                {s.total_wins}-{s.total_losses} • {s.total_wins + s.total_losses} attacks
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
          )}

          {activeTab === "admin" && canEdit && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="text-center">
                <h2 className="text-4xl md:text-5xl font-black text-white italic uppercase tracking-tight mb-2">
                  Admin <span className="text-rose-400">Controls</span>
                </h2>
                <p className="text-slate-400 font-semibold">
                  Remove ex-members from the guild database (deletes their performance rows)
                </p>
              </div>

              <div className="bg-slate-950/15 glass p-6 md:p-8 rounded-[2rem] border-2 border-white/10">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                  <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                    Member Roster
                  </h3>
                  <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                    {stats.length} members in reports
                  </div>
                </div>

                {stats.length === 0 ? (
                  <div className="text-slate-500 font-semibold">No member data yet.</div>
                ) : (
                  <div className="overflow-x-auto border border-white/10 rounded-2xl">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-950/30 text-slate-400">
                        <tr>
                          <th className="p-4 font-black uppercase text-xs tracking-wider">Member</th>
                          <th className="p-4 font-black uppercase text-xs tracking-wider">Wars</th>
                          <th className="p-4 font-black uppercase text-xs tracking-wider">Wins</th>
                          <th className="p-4 font-black uppercase text-xs tracking-wider">Losses</th>
                          <th className="p-4 font-black uppercase text-xs tracking-wider">Def Wins</th>
                          <th className="p-4 font-black uppercase text-xs tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10 bg-slate-900/10">
                        {[...stats]
                          .sort((a, b) => a.member_name.localeCompare(b.member_name))
                          .map((s) => (
                            <tr key={s.member_name} className="hover:bg-white/5 transition-colors">
                              <td className="p-4 font-black text-white">{s.member_name}</td>
                              <td className="p-4 font-mono font-bold text-slate-200">{s.total_wars}</td>
                              <td className="p-4 font-mono font-bold text-green-400">{s.total_wins}</td>
                              <td className="p-4 font-mono font-bold text-rose-400">{s.total_losses}</td>
                              <td className="p-4 font-mono font-bold text-blue-400">{s.total_def_wins}</td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => requestDeleteMember(s)}
                                  className="px-4 py-2 bg-rose-600/90 hover:bg-rose-500 text-white font-black text-xs rounded-xl border border-white/10 transition-all"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
