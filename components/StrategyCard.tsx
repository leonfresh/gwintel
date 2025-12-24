import React, { useState } from "react";
import { StrategyLog, Hero, LogType } from "../types";
import { HERO_DATABASE } from "../constants";

interface Props {
  enemyIds: string[];
  logs: StrategyLog[];
  squadVotes: number;
  squadCreator: string;
  compactView: boolean;
  onVote: (id: string, type: "up" | "down") => void;
  onSquadVote: (type: "up" | "down") => void;
  onAddLog: (enemyIds: string[], type: LogType) => void;
}

const StrategyCard: React.FC<Props> = ({
  enemyIds,
  logs,
  squadVotes,
  squadCreator,
  compactView,
  onVote,
  onSquadVote,
  onAddLog,
}) => {
  const [mobileExpandSuccess, setMobileExpandSuccess] = useState(false);
  const [mobileExpandFail, setMobileExpandFail] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const getHero = (id: string) => HERO_DATABASE.find((h) => h.id === id);

  const handleImageError = (heroId: string) => {
    setImageErrors((prev) => ({ ...prev, [heroId]: true }));
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

  const HeroNameChip: React.FC<{
    heroId: string;
    tone: "success" | "fail";
  }> = ({ heroId, tone }) => {
    const hero = getHero(heroId);
    const [imageOk, setImageOk] = useState(true);

    if (!hero) return null;

    const palette =
      tone === "success"
        ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/20"
        : "bg-rose-500/10 text-rose-200 border-rose-500/20";
    const ring = tone === "success" ? "border-emerald-400/30" : "border-rose-400/30";

    return (
      <span
        className={`inline-flex items-center gap-2 text-xs font-black px-3 py-1 rounded-lg shadow-sm border ${palette}`}
      >
        <span
          className={`w-4 h-4 rounded-full overflow-hidden border ${ring} bg-slate-950/25 glass flex items-center justify-center text-[9px] font-black text-slate-200`}
          aria-hidden="true"
        >
          {imageOk ? (
            <img
              src={`/heroes/${hero.id}.png`}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImageOk(false)}
            />
          ) : (
            <span className="leading-none">{hero.name.charAt(0)}</span>
          )}
        </span>
        <span>{hero.name}</span>
      </span>
    );
  };

  const EnemySquadHeader: React.FC = () => (
    <div className="bg-slate-950/20 glass px-8 py-6 border-b border-white/10 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
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
        <div className="flex flex-col items-center gap-1 bg-slate-950/25 glass py-3 px-4 rounded-xl border border-white/10 shadow-lg">
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

      <div className="flex-1 flex flex-wrap justify-center md:justify-start gap-6">
        {enemyIds.map((id, index) => {
          const hero = getHero(id);
          const isTopThree = index < 3;
          const showImage = isTopThree && !imageErrors[id];
          return hero ? (
            <div key={id} className="flex flex-col items-center gap-2 group">
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
            </div>
          ) : null;
        })}
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

  const LogEntry: React.FC<{ log: StrategyLog }> = ({ log }) => (
    <div className="p-5 bg-slate-950/15 glass rounded-2xl border border-white/10 group hover:border-white/20 transition-all hover:bg-slate-950/25 shadow-sm hover:shadow-xl">
      <div className="flex justify-between items-start gap-6">
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap gap-2">
            {log.counterTeam.map((id) => (
              <HeroNameChip
                key={id}
                heroId={id}
                tone={log.type === "success" ? "success" : "fail"}
              />
            ))}
          </div>
          <p className="text-sm text-slate-300 italic leading-relaxed border-l-2 border-slate-700 pl-4 py-1">
            "{log.notes || "No specific tactics recorded."}"
          </p>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-black text-white">
              {log.author.charAt(0).toUpperCase()}
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Intel by <span className="text-blue-400">{log.author}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 min-w-[48px] bg-slate-950/20 glass py-2 rounded-xl border border-white/10">
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
    </div>
  );

  return (
    <div className="bg-slate-950/15 glass rounded-[2rem] border-2 border-white/10 overflow-hidden shadow-2xl mb-12 hover:border-white/20 transition-colors">
      <EnemySquadHeader />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-0">
        {/* Effective Column */}
        <div
          className={`p-8 border-r border-white/10 bg-slate-950/10 transition-all ${
            compactView ? "group relative" : ""
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
            className={`space-y-6 transition-all duration-300 ${
              compactView
                ? "hidden xl:group-hover:block " +
                  (mobileExpandSuccess ? "!block" : "")
                : ""
            }`}
          >
            {successLogs.length > 0 ? (
              successLogs.map((log) => <LogEntry key={log.id} log={log} />)
            ) : (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-700/50 rounded-3xl opacity-40">
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest">
                  No strategies found
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Fail Column */}
        <div
          className={`p-8 bg-slate-950/10 transition-all ${
            compactView ? "group relative" : ""
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
              Verified Fails
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
            className={`space-y-6 transition-all duration-300 ${
              compactView
                ? "hidden xl:group-hover:block " +
                  (mobileExpandFail ? "!block" : "")
                : ""
            }`}
          >
            {failLogs.length > 0 ? (
              failLogs.map((log) => <LogEntry key={log.id} log={log} />)
            ) : (
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-700/50 rounded-3xl opacity-40">
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest">
                  No data available
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyCard;
