import React, { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { StrategyLog, LogType, SkillQueueItem } from "../types";
import { HERO_DATABASE } from "../constants";
import HeroHoverCard from "./HeroHoverCard";

interface Props {
  squadKey: string;
  enemyIds: string[];
  logs: StrategyLog[];
  squadVotes: number;
  squadCreator: string;
  compactView: boolean;
  currentUserId: string | null;
  currentUserName?: string | null;
  highlightLogId?: string | null;
  onVote: (id: string, type: "up" | "down") => void;
  onSquadVote: (type: "up" | "down") => void;
  onAddLog: (enemyIds: string[], type: LogType) => void;
  onDeleteLog: (id: string) => void;
  onEditLog: (log: StrategyLog) => void;
  onUpdateEnemyTeamOrder?: (newOrder: string[]) => void;
  onUpdateLogCounterTeam?: (logId: string, newOrder: string[]) => void;
}

const StrategyCard: React.FC<Props> = ({
  squadKey,
  enemyIds,
  logs,
  squadVotes,
  squadCreator,
  compactView,
  currentUserId,
  currentUserName,
  highlightLogId,
  onVote,
  onSquadVote,
  onAddLog,
  onDeleteLog,
  onEditLog,
  onUpdateEnemyTeamOrder,
  onUpdateLogCounterTeam,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [mobileExpandSuccess, setMobileExpandSuccess] = useState(false);
  const [mobileExpandFail, setMobileExpandFail] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedLogId, setDraggedLogId] = useState<string | null>(null);

  const isIcewind = currentUserName === "Icewind";

  const getHero = (id: string) => HERO_DATABASE.find((h) => h.id === id);

  const buildShareUrl = (opts?: { counterIds?: string[]; logId?: string }) => {
    const params = new URLSearchParams();
    params.set("squad", squadKey);
    if (opts?.counterIds && opts.counterIds.length > 0) {
      params.set("counter", opts.counterIds.join(","));
    }
    if (opts?.logId) params.set("log", opts.logId);
    return `${window.location.origin}/?${params.toString()}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        ta.style.left = "-1000px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  };

  const handleCopySquadLink = async (opts?: {
    counterIds?: string[];
    logId?: string;
  }) => {
    const url = buildShareUrl(opts);
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  };

  const handleExportPng = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `squad-${squadKey.replaceAll(",", "-")}.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  };

  const handleImageError = (heroId: string) => {
    setImageErrors((prev) => ({ ...prev, [heroId]: true }));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    setDraggedLogId(null); // Ensure we are dragging enemy team
    e.dataTransfer.effectAllowed = "move";

    // Set custom drag image to the circle avatar
    const target = e.currentTarget as HTMLElement;
    const img = target.querySelector("img");
    if (img) {
      e.dataTransfer.setDragImage(img, 32, 32);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex || draggedLogId)
      return;

    const newOrder = [...enemyIds];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, removed);

    if (onUpdateEnemyTeamOrder) {
      onUpdateEnemyTeamOrder(newOrder);
    }
    setDraggedIndex(null);
  };

  const handleCounterDragStart = (
    e: React.DragEvent,
    index: number,
    logId: string
  ) => {
    setDraggedIndex(index);
    setDraggedLogId(logId);
    e.dataTransfer.effectAllowed = "move";

    // Set custom drag image to the circle avatar
    const target = e.currentTarget as HTMLElement;
    const img = target.querySelector("img");
    if (img) {
      e.dataTransfer.setDragImage(img, 32, 32);
    }
  };

  const handleCounterDrop = (
    e: React.DragEvent,
    dropIndex: number,
    log: StrategyLog
  ) => {
    e.preventDefault();
    if (
      draggedIndex === null ||
      draggedIndex === dropIndex ||
      draggedLogId !== log.id
    )
      return;

    const newOrder = [...log.counterTeam];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, removed);

    if (onUpdateLogCounterTeam) {
      onUpdateLogCounterTeam(log.id, newOrder);
    }
    setDraggedIndex(null);
    setDraggedLogId(null);
  };
  const successLogs = logs
    .filter((l) => l.type === "success")
    .sort((a, b) => b.votes - a.votes);
  const failLogs = logs
    .filter((l) => l.type === "fail")
    .sort((a, b) => b.votes - a.votes);

  // Determine overall threat level based on the highest hero tier
  const tierWeights = {
    SSS: 8,
    SS: 7,
    "S+": 6,
    S: 5,
    "A+": 4,
    A: 3,
    B: 2,
    C: 1,
    D: 0,
  };
  const overallTier = enemyIds.reduce((max, id) => {
    const hero = getHero(id);
    if (!hero) return max;
    return tierWeights[hero.tier] > tierWeights[max as keyof typeof tierWeights]
      ? hero.tier
      : max;
  }, "D");

  const getTierColor = (tier: string) => {
    if (tier.includes("SSS")) return "from-yellow-400 to-orange-600 text-white";
    if (tier.includes("SS")) return "from-purple-500 to-indigo-700 text-white";
    if (tier.includes("S")) return "from-blue-500 to-blue-700 text-white";
    return "from-slate-600 to-slate-800 text-slate-300";
  };

  const EnemySquadHeader: React.FC = () => (
    <div className="bg-slate-900/60 glass px-8 py-6 border-b border-white/10 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
      {/* Background Decor */}
      <div
        className={`absolute -right-8 -top-8 w-32 h-32 blur-3xl opacity-20 bg-gradient-to-br ${getTierColor(
          overallTier
        )}`}
      ></div>

      {/* Squad Votes with Up/Down Buttons */}
      <div className="flex flex-col items-center gap-2">
        <div
          className={`text-[10px] font-black uppercase tracking-[0.3em] ${
            squadVotes >= 0 ? "text-emerald-500" : "text-rose-500"
          }`}
        >
          Squad Rating
        </div>
        <div className="flex flex-col items-center gap-1 bg-slate-900/60 glass py-3 px-4 rounded-xl border border-white/10 shadow-lg">
          <button
            onClick={() => onSquadVote("up")}
            className="text-slate-500 hover:text-emerald-400 transition-all transform hover:scale-125 active:scale-95"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M14.707 9.293l-4-4a1 1 0 00-1.414 0l-4 4a1 1 0 101.414 1.414L9 8.414V15a1 1 0 102 0V8.414l2.293 2.293a1 1 0 001.414-1.414z" />
            </svg>
          </button>
          <div
            className={`text-2xl font-black italic ${
              squadVotes >= 10
                ? "text-yellow-400"
                : squadVotes >= 5
                ? "text-emerald-400"
                : squadVotes > 0
                ? "text-blue-400"
                : squadVotes < 0
                ? "text-rose-400"
                : "text-slate-400"
            }`}
          >
            {squadVotes > 0 ? `+${squadVotes}` : squadVotes}
          </div>
          <button
            onClick={() => onSquadVote("down")}
            className="text-slate-500 hover:text-rose-400 transition-all transform hover:scale-125 active:scale-95"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5.293 10.707l4 4a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L11 11.586V5a1 1 0 10-2 0v6.586L6.707 9.293a1 1 0 00-1.414 1.414z" />
            </svg>
          </button>
        </div>
        <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
          {logs.length} {logs.length === 1 ? "report" : "reports"}
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div
          className={`text-[10px] font-black uppercase tracking-[0.3em] mb-1 text-slate-500`}
        >
          Threat Level
        </div>
        <div
          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getTierColor(
            overallTier
          )} flex items-center justify-center text-2xl font-black shadow-2xl border border-white/10 italic`}
        >
          {overallTier}
        </div>
      </div>

      {/* Share / Export */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => handleCopySquadLink()}
          className="px-4 py-2 bg-slate-900/40 glass hover:bg-slate-900/55 text-slate-200 rounded-xl text-[10px] font-black transition-all border border-white/10 uppercase tracking-widest"
          title="Copy share link"
        >
          {copied ? "COPIED" : "COPY LINK"}
        </button>
        <button
          type="button"
          onClick={handleExportPng}
          disabled={exporting}
          className="px-4 py-2 bg-slate-900/40 glass hover:bg-slate-900/55 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 rounded-xl text-[10px] font-black transition-all border border-white/10 uppercase tracking-widest"
          title="Export this squad card as PNG"
        >
          {exporting ? "EXPORTING" : "EXPORT PNG"}
        </button>
      </div>

      <div className="flex-1">
        {/* Mobile: keep 3 icons on a single row */}
        <div className="md:hidden flex items-center justify-center gap-2 flex-nowrap">
          {enemyIds.slice(0, 3).map((id, index) => {
            const hero = getHero(id);
            if (!hero) return null;
            const showImage = !imageErrors[id];
            return (
              <div
                key={id}
                draggable={isIcewind}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => handleDrop(e, index)}
                className={`${
                  isIcewind ? "cursor-move active:cursor-grabbing" : ""
                } shrink-0`}
              >
                <HeroHoverCard hero={hero}>
                  <div className="relative" tabIndex={0}>
                    <div
                      className={`w-14 h-14 rounded-full bg-slate-950/25 glass border-2 overflow-hidden flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.35)] ${
                        hero.attackType === "Magic"
                          ? "border-blue-500/50"
                          : "border-orange-500/50"
                      }`}
                    >
                      {showImage ? (
                        <img
                          src={`/heroes/${id}.png`}
                          alt={hero.name}
                          className="w-full h-full object-cover"
                          onError={() => handleImageError(id)}
                        />
                      ) : (
                        <span className="text-white font-black text-[10px] text-center leading-none px-1">
                          {hero.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div
                      className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-gradient-to-br ${getTierColor(
                        hero.tier
                      )} border border-white/10 shadow-lg`}
                    >
                      {hero.tier}
                    </div>
                  </div>
                </HeroHoverCard>
              </div>
            );
          })}
        </div>

        {/* Desktop/tablet: larger icons + labels */}
        <div className="hidden md:flex flex-wrap justify-center md:justify-start gap-6">
          {enemyIds.map((id, index) => {
            const hero = getHero(id);
            const isTopThree = index < 3;
            const showImage = isTopThree && !imageErrors[id];
            return hero ? (
              <div
                key={id}
                draggable={isIcewind}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => handleDrop(e, index)}
                className={
                  isIcewind ? "cursor-move active:cursor-grabbing" : ""
                }
              >
                <HeroHoverCard hero={hero}>
                  <div
                    className="flex flex-col items-center gap-2 group"
                    tabIndex={0}
                  >
                    <div className="relative">
                      <div
                        className={`${
                          isTopThree ? "w-20 h-20" : "w-14 h-14"
                        } rounded-full bg-slate-950/25 glass border-2 flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden ${
                          hero.attackType === "Magic"
                            ? "border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                            : "border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
                        }`}
                      >
                        {showImage ? (
                          <img
                            src={`/heroes/${id}.png`}
                            alt={hero.name}
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(id)}
                          />
                        ) : (
                          <span
                            className={`text-white font-black ${
                              isTopThree ? "text-sm" : "text-xs"
                            } text-center leading-none px-1`}
                          >
                            {hero.name}
                          </span>
                        )}
                      </div>
                      <div
                        className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-gradient-to-br ${getTierColor(
                          hero.tier
                        )} border border-white/10 shadow-lg`}
                      >
                        {hero.tier}
                      </div>
                    </div>
                    <div
                      className={`text-[10px] font-bold text-slate-300 text-center leading-tight max-w-[5.5rem] ${
                        isTopThree ? "" : "opacity-80"
                      }`}
                    >
                      {hero.name}
                    </div>
                  </div>
                </HeroHoverCard>
              </div>
            ) : null;
          })}
        </div>
      </div>

      <div className="hidden md:block">
        <div className="text-right space-y-3">
          <div>
            <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
              Squad Reported By
            </div>
            <div className="text-blue-400 font-bold text-xs mt-1">
              {squadCreator}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
              Database ID
            </div>
            <div className="text-slate-400 font-mono text-xs">
              {enemyIds.join("-").substring(0, 12)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const LogEntry: React.FC<{ log: StrategyLog }> = ({ log }) => {
    const isOwnPost = Boolean(currentUserId && log.authorId === currentUserId);
    const tintClass =
      log.type === "success" ? "log-tint-success" : "log-tint-fail";
    const isHighlighted = Boolean(highlightLogId && log.id === highlightLogId);

    const SkillQueueRow: React.FC<{ queue: SkillQueueItem[] }> = ({
      queue,
    }) => {
      if (!queue || queue.length === 0) return null;

      return (
        <div className="flex flex-col items-start md:items-end gap-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-blue-300">
            Skill Queue
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end">
            {queue.slice(0, 3).map((s, idx) => {
              const hero = getHero(s.heroId);
              const badge = s.skill === "top" ? "T" : "B";
              return (
                <div
                  key={`${s.heroId}-${idx}`}
                  className="flex items-center gap-2"
                >
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl border border-white/10 bg-slate-950/20 glass text-slate-200 text-xs font-black">
                    <span className="w-5 h-5 rounded-full overflow-hidden border border-white/10 bg-slate-950/40 flex items-center justify-center text-[10px]">
                      {hero ? (
                        imageErrors[hero.id] ? (
                          <span className="text-white font-black">
                            {hero.name.charAt(0)}
                          </span>
                        ) : (
                          <img
                            src={`/heroes/${hero.id}.png`}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(hero.id)}
                          />
                        )
                      ) : (
                        <span className="text-white font-black">?</span>
                      )}
                    </span>
                    <span className="text-slate-300">
                      {hero ? hero.name : "Unknown"}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-lg bg-blue-500/25 border border-blue-500/30 text-blue-100 text-[10px] font-black">
                      {badge}
                    </span>
                  </span>
                  {idx < Math.min(queue.length, 3) - 1 ? (
                    <span className="text-slate-600 text-xs font-black">
                      &gt;
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div
        id={`log-${log.id}`}
        className={`relative overflow-hidden p-5 bg-slate-900/70 glass rounded-2xl border border-white/10 group hover:border-white/20 transition-all shadow-sm hover:shadow-xl ${tintClass} ${
          isHighlighted ? "ring-2 ring-blue-500/35" : ""
        }`}
      >
        <div className="flex justify-between items-start gap-6">
          <div className="flex items-start gap-5 flex-1">
            {/* Desktop: stacked hero icons */}
            <div className="hidden md:flex flex-col gap-2">
              {log.counterTeam.slice(0, 3).map((id, index) => {
                const hero = getHero(id);
                if (!hero) return null;
                const ring =
                  log.type === "success"
                    ? "border-emerald-400/30"
                    : "border-rose-400/30";
                const border =
                  hero.attackType === "Magic"
                    ? "border-blue-500/50"
                    : "border-orange-500/50";
                return (
                  <div
                    key={id}
                    draggable={isIcewind}
                    onDragStart={(e) =>
                      handleCounterDragStart(e, index, log.id)
                    }
                    onDragOver={(e) => handleDragOver(e)}
                    onDrop={(e) => handleCounterDrop(e, index, log)}
                    className={
                      isIcewind ? "cursor-move active:cursor-grabbing" : ""
                    }
                  >
                    <HeroHoverCard hero={hero}>
                      <div
                        tabIndex={0}
                        className={`w-16 h-16 rounded-full bg-slate-950/25 glass border-2 ${border} overflow-hidden flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.35)] hover:scale-105 transition-transform`}
                      >
                        {!imageErrors[id] ? (
                          <img
                            src={`/heroes/${id}.png`}
                            alt={hero.name}
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(id)}
                          />
                        ) : (
                          <span className="text-white font-black text-sm text-center leading-none px-1">
                            {hero.name}
                          </span>
                        )}
                        <span className="sr-only">{hero.name}</span>
                        <span className={`sr-only ${ring}`}></span>
                      </div>
                    </HeroHoverCard>
                  </div>
                );
              })}
            </div>

            <div className="flex-1 space-y-4 pb-4 md:pb-10">
              {/* Mobile: chips */}
              <div className="md:hidden flex items-center gap-2 flex-nowrap overflow-x-auto pb-1 -mx-1 px-1">
                {log.counterTeam.slice(0, 3).map((id, index) => {
                  const hero = getHero(id);
                  if (!hero) return null;
                  const border =
                    hero.attackType === "Magic"
                      ? "border-blue-500/50"
                      : "border-orange-500/50";
                  return (
                    <div
                      key={id}
                      className="shrink-0"
                      draggable={isIcewind}
                      onDragStart={(e) =>
                        handleCounterDragStart(e, index, log.id)
                      }
                      onDragOver={(e) => handleDragOver(e)}
                      onDrop={(e) => handleCounterDrop(e, index, log)}
                    >
                      <HeroHoverCard hero={hero}>
                        <div
                          tabIndex={0}
                          className={`w-12 h-12 rounded-full bg-slate-950/25 glass border-2 ${border} overflow-hidden flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.35)]`}
                        >
                          {!imageErrors[id] ? (
                            <img
                              src={`/heroes/${id}.png`}
                              alt={hero.name}
                              className="w-full h-full object-cover"
                              onError={() => handleImageError(id)}
                            />
                          ) : (
                            <span className="text-white font-black text-[10px] text-center leading-none px-1">
                              {hero.name.charAt(0)}
                            </span>
                          )}
                          <span className="sr-only">{hero.name}</span>
                        </div>
                      </HeroHoverCard>
                    </div>
                  );
                })}
              </div>

              <p className="text-sm text-slate-300 italic leading-relaxed border-l-2 border-slate-700 pl-4 py-1">
                “{log.notes || "No specific tactics recorded."}”
              </p>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-black text-white">
                  {log.author.charAt(0).toUpperCase()}
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Intel by <span className="text-blue-400">{log.author}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() =>
                    handleCopySquadLink({
                      counterIds: log.counterTeam,
                      logId: log.id,
                    })
                  }
                  className="flex items-center gap-1 text-slate-500 hover:text-blue-400 transition-all transform hover:scale-105 active:scale-95 text-xs font-bold"
                  title="Copy share link (includes enemy + counter team)"
                  aria-label="Copy share link"
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
                      strokeWidth="2.5"
                      d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 4"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M14 11a5 5 0 01-7.07 0L5.5 9.59a5 5 0 017.07-7.07L14 4"
                    />
                  </svg>
                  <span>Share</span>
                </button>

                {isOwnPost && (
                  <>
                    <button
                      onClick={() => onEditLog(log)}
                      className="flex items-center gap-1 text-slate-500 hover:text-blue-400 transition-all transform hover:scale-105 active:scale-95 text-xs font-bold"
                      title="Edit your post"
                      aria-label="Edit your post"
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
                          strokeWidth="2.5"
                          d="M11 4h-3a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-3"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                        />
                      </svg>
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => onDeleteLog(log.id)}
                      className="flex items-center gap-1 text-slate-500 hover:text-rose-400 transition-all transform hover:scale-105 active:scale-95 text-xs font-bold"
                      title="Delete your post"
                      aria-label="Delete your post"
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
                          strokeWidth="3"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 min-w-[48px] bg-slate-900/80 glass py-2 rounded-xl border border-white/10">
            <button
              onClick={() => onVote(log.id, "up")}
              className="text-slate-500 hover:text-emerald-400 transition-all transform hover:scale-125 active:scale-95"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M14.707 9.293l-4-4a1 1 0 00-1.414 0l-4 4a1 1 0 101.414 1.414L9 8.414V15a1 1 0 102 0V8.414l2.293 2.293a1 1 0 001.414-1.414z" />
              </svg>
            </button>
            <span
              className={`text-sm font-black italic ${
                log.votes >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {log.votes > 0 ? `+${log.votes}` : log.votes}
            </span>
            <button
              onClick={() => onVote(log.id, "down")}
              className="text-slate-500 hover:text-rose-400 transition-all transform hover:scale-125 active:scale-95"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5.293 10.707l4 4a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L11 11.586V5a1 1 0 10-2 0v6.586L6.707 9.293a1 1 0 00-1.414 1.414z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Skill Queue: inline on mobile, bottom-right on md+ */}
        {log.skillQueue && log.skillQueue.length > 0 && (
          <div className="mt-4 md:mt-0 md:absolute md:bottom-0 md:right-0 px-0 md:px-5 pb-0 md:pb-3 max-w-full md:max-w-[calc(100%-5rem)]">
            <SkillQueueRow queue={log.skillQueue} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={cardRef}
      className="bg-slate-900/60 glass bg-grain rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl mb-12 hover:border-white/20 transition-colors"
    >
      <EnemySquadHeader />
      <div
        className={
          compactView ? "grid grid-cols-1 xl:grid-cols-2 gap-0" : "space-y-0"
        }
      >
        {/* Effective Column */}
        <div
          className={`p-8 bg-slate-950/10 transition-all ${
            compactView ? "group relative border-r border-white/10" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="flex items-center gap-3 text-emerald-400 font-black text-sm uppercase tracking-[0.25em]">
              <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="4"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              Successful Counters
              {compactView && (
                <button
                  onClick={() => setMobileExpandSuccess(!mobileExpandSuccess)}
                  className="xl:hidden p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-all"
                  title="Show/hide details"
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
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              )}
            </h3>
            <button
              onClick={() => onAddLog(enemyIds, "success")}
              className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/20 transition-all group active:scale-90"
              title="Add new counter strategy"
            >
              <svg
                className="w-5 h-5 group-hover:rotate-90 transition-transform"
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
          </div>
          <div
            className={`transition-all duration-300 ${
              compactView
                ? "space-y-6 hidden xl:group-hover:block " +
                  (mobileExpandSuccess ? "!block" : "")
                : "grid grid-cols-1 lg:grid-cols-2 gap-6"
            }`}
          >
            {successLogs.length > 0 ? (
              successLogs.map((log) => <LogEntry key={log.id} log={log} />)
            ) : (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-700/50 rounded-3xl">
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest">
                  No strategies found
                </p>
                <button
                  onClick={() => onAddLog(enemyIds, "success")}
                  className="mt-4 px-4 py-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-300 text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  Add first successful counter
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fail Column */}
        <div
          className={`p-8 bg-slate-950/10 transition-all ${
            compactView ? "group relative" : "border-t border-white/10"
          }`}
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="flex items-center gap-3 text-rose-500 font-black text-sm uppercase tracking-[0.25em]">
              <div className="p-1.5 bg-rose-500/20 rounded-lg">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="4"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              Ineffective Counters
              {compactView && (
                <button
                  onClick={() => setMobileExpandFail(!mobileExpandFail)}
                  className="xl:hidden p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg border border-rose-500/20 transition-all"
                  title="Show/hide details"
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
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              )}
            </h3>
            <button
              onClick={() => onAddLog(enemyIds, "fail")}
              className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl border border-rose-500/20 transition-all group active:scale-90"
              title="Add new fail report"
            >
              <svg
                className="w-5 h-5 group-hover:rotate-90 transition-transform"
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
          </div>
          <div
            className={`transition-all duration-300 ${
              compactView
                ? "space-y-6 hidden xl:group-hover:block " +
                  (mobileExpandFail ? "!block" : "")
                : "grid grid-cols-1 lg:grid-cols-2 gap-6"
            }`}
          >
            {failLogs.length > 0 ? (
              failLogs.map((log) => <LogEntry key={log.id} log={log} />)
            ) : (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-700/50 rounded-3xl">
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest">
                  No strategies found
                </p>
                <button
                  onClick={() => onAddLog(enemyIds, "fail")}
                  className="mt-4 px-4 py-2 rounded-xl border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/15 text-rose-300 text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  Add first ineffective counter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyCard;

// Scoped styles for log card gradient tint
const styles = `
  @media (min-width: 768px) {
    .log-tint-success::before,
    .log-tint-fail::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 7rem;
      background: linear-gradient(to right, var(--tint-color), transparent);
      pointer-events: none;
    }
    
    .log-tint-success::before {
      --tint-color: rgba(16, 185, 129, 0.18);
    }
    
    .log-tint-fail::before {
      --tint-color: rgba(244, 63, 94, 0.18);
    }
  }
  
  /* Hide scrollbar for skill queue row */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("strategy-card-styles")
) {
  const styleEl = document.createElement("style");
  styleEl.id = "strategy-card-styles";
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
