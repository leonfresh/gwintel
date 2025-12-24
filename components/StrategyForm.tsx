import React, { useState, useEffect } from "react";
import {
  Hero,
  StrategyLog,
  LogType,
  SkillQueueItem,
  SkillChoice,
} from "../types";
import HeroAutocomplete from "./HeroAutocomplete";
import { HERO_DATABASE } from "../constants";
import HeroHoverCard from "./HeroHoverCard";

interface Props {
  onSubmit: (
    log: Pick<
      StrategyLog,
      "enemyTeam" | "counterTeam" | "type" | "notes" | "skillQueue"
    >
  ) => void;
  onCancel: () => void;
  initialEnemyTeam?: string[];
  initialType?: LogType;
  initialCounterTeam?: string[];
  initialNotes?: string;
  initialSkillQueue?: SkillQueueItem[];
}

const StrategyForm: React.FC<Props> = ({
  onSubmit,
  onCancel,
  initialEnemyTeam,
  initialType,
  initialCounterTeam,
  initialNotes,
  initialSkillQueue,
}) => {
  const [enemyTeam, setEnemyTeam] = useState<Hero[]>([]);
  const [counterTeam, setCounterTeam] = useState<Hero[]>([]);
  const [type, setType] = useState<LogType>(initialType || "success");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string>("");
  const [skillQueue, setSkillQueue] = useState<SkillQueueItem[]>([]);

  useEffect(() => {
    if (initialEnemyTeam) {
      const heroes = initialEnemyTeam
        .map((id) => HERO_DATABASE.find((h) => h.id === id))
        .filter(Boolean) as Hero[];
      setEnemyTeam(heroes);
    }
  }, [initialEnemyTeam]);

  useEffect(() => {
    if (initialType) setType(initialType);
  }, [initialType]);

  useEffect(() => {
    if (initialCounterTeam) {
      const heroes = initialCounterTeam
        .map((id) => HERO_DATABASE.find((h) => h.id === id))
        .filter(Boolean) as Hero[];
      setCounterTeam(heroes);
    }
  }, [initialCounterTeam]);

  useEffect(() => {
    if (typeof initialNotes === "string") setNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    if (Array.isArray(initialSkillQueue)) setSkillQueue(initialSkillQueue);
  }, [initialSkillQueue]);

  useEffect(() => {
    // Keep queue valid when counter team changes
    const allowed = new Set(counterTeam.map((h) => h.id));
    setSkillQueue((prev) => prev.filter((x) => allowed.has(x.heroId)));
  }, [counterTeam]);

  const handleAddEnemy = (hero: Hero) => {
    if (enemyTeam.length < 3 && !enemyTeam.find((h) => h.id === hero.id)) {
      setEnemyTeam([...enemyTeam, hero]);
    }
  };

  const handleAddCounter = (hero: Hero) => {
    if (counterTeam.length < 3 && !counterTeam.find((h) => h.id === hero.id)) {
      setCounterTeam([...counterTeam, hero]);
    }
  };

  const removeHero = (
    list: Hero[],
    setList: (h: Hero[]) => void,
    id: string
  ) => {
    setList(list.filter((h) => h.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enemyTeam.length < 1 || counterTeam.length < 1) {
      setFormError("Please select at least 1 hero for both teams.");
      return;
    }
    setFormError("");
    onSubmit({
      enemyTeam: enemyTeam.map((h) => h.id).sort(),
      counterTeam: counterTeam.map((h) => h.id),
      type,
      notes,
      skillQueue,
    });
  };

  const addSkillSlot = () => {
    if (skillQueue.length >= 3) return;
    if (counterTeam.length === 0) return;
    const defaultHeroId = counterTeam[0].id;
    setSkillQueue((prev) => [...prev, { heroId: defaultHeroId, skill: "top" }]);
  };

  const updateSkillSlot = (idx: number, patch: Partial<SkillQueueItem>) => {
    setSkillQueue((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );
  };

  const removeSkillSlot = (idx: number) => {
    setSkillQueue((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl space-y-8 animate-in fade-in zoom-in-95 duration-300"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-white italic tracking-tight">
          LOG NEW INTELLIGENCE
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"
        >
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Enemy Team */}
        <div className="space-y-4">
          <label className="block text-xs font-black text-rose-500 uppercase tracking-[0.2em]">
            Target Enemy Squad
          </label>
          {!initialEnemyTeam && (
            <HeroAutocomplete
              onSelect={handleAddEnemy}
              placeholder="Search for enemy heroes..."
            />
          )}
          <div className="flex flex-wrap gap-3 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 min-h-[72px]">
            {enemyTeam.length === 0 && (
              <span className="text-slate-600 text-sm italic py-2">
                No heroes selected...
              </span>
            )}
            {enemyTeam.map((h) => (
              <span
                key={h.id}
                className="inline-flex items-center px-4 py-2 bg-rose-500/10 text-rose-300 border border-rose-500/30 rounded-xl text-sm font-bold shadow-lg"
              >
                <HeroHoverCard hero={h}>
                  <span
                    className="relative w-6 h-6 rounded-full overflow-hidden border border-white/10 bg-slate-950/40 flex items-center justify-center mr-2"
                    tabIndex={0}
                  >
                    <span className="text-white font-black text-[10px]">
                      {h.name.charAt(0)}
                    </span>
                    <img
                      src={`/heroes/${h.id}.png`}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </span>
                </HeroHoverCard>
                {h.name}
                {!initialEnemyTeam && (
                  <button
                    type="button"
                    onClick={() => removeHero(enemyTeam, setEnemyTeam, h.id)}
                    className="ml-2 text-rose-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Entry Type & Team */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
              Your Counter-Force
            </label>
            <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-700 shadow-inner">
              <button
                type="button"
                onClick={() => setType("success")}
                className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${
                  type === "success"
                    ? "bg-emerald-600 text-white shadow-lg"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                SUCCESS
              </button>
              <button
                type="button"
                onClick={() => setType("fail")}
                className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${
                  type === "fail"
                    ? "bg-rose-600 text-white shadow-lg"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                FAIL
              </button>
            </div>
          </div>
          <HeroAutocomplete
            onSelect={handleAddCounter}
            placeholder="Who did you use?"
          />
          <div
            className={`flex flex-wrap gap-3 p-4 bg-slate-900/50 rounded-xl border min-h-[72px] transition-colors ${
              type === "success"
                ? "border-emerald-500/20"
                : "border-rose-500/20"
            }`}
          >
            {counterTeam.length === 0 && (
              <span className="text-slate-600 text-sm italic py-2">
                Search and select heroes...
              </span>
            )}
            {counterTeam.map((h) => (
              <span
                key={h.id}
                className={`inline-flex items-center px-4 py-2 border rounded-xl text-sm font-bold shadow-lg ${
                  type === "success"
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-300 border-rose-500/30"
                }`}
              >
                <HeroHoverCard hero={h}>
                  <span
                    className="relative w-6 h-6 rounded-full overflow-hidden border border-white/10 bg-slate-950/40 flex items-center justify-center mr-2"
                    tabIndex={0}
                  >
                    <span className="text-white font-black text-[10px]">
                      {h.name.charAt(0)}
                    </span>
                    <img
                      src={`/heroes/${h.id}.png`}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </span>
                </HeroHoverCard>
                {h.name}
                <button
                  type="button"
                  onClick={() => removeHero(counterTeam, setCounterTeam, h.id)}
                  className="ml-2 hover:text-white"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          {/* Skill Queue */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                Skill Queue (Optional)
              </label>
              <button
                type="button"
                onClick={addSkillSlot}
                disabled={counterTeam.length === 0 || skillQueue.length >= 3}
                className="px-3 py-1.5 bg-slate-900/35 glass hover:bg-slate-900/55 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-xl text-[10px] font-black transition-all border border-white/10"
              >
                + ADD SKILL
              </button>
            </div>

            <div className="space-y-3">
              {skillQueue.length === 0 ? (
                <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/20 glass text-slate-500 text-xs font-bold">
                  Queue up to 3 skills (Top/Bottom) for your offense team.
                </div>
              ) : null}

              {skillQueue.map((slot, idx) => (
                <div
                  key={`${slot.heroId}-${idx}`}
                  className="p-4 rounded-2xl border border-white/10 bg-slate-900/35 glass flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-16">
                    #{idx + 1}
                  </div>

                  <div className="flex-1 flex items-center gap-3">
                    {(() => {
                      const hero = HERO_DATABASE.find(
                        (h) => h.id === slot.heroId
                      );
                      return hero ? (
                        <HeroHoverCard hero={hero}>
                          <span
                            className="relative w-7 h-7 rounded-full overflow-hidden border border-white/10 bg-slate-950/40 flex items-center justify-center"
                            tabIndex={0}
                          >
                            <span className="text-white font-black text-[10px]">
                              {hero.name.charAt(0)}
                            </span>
                            <img
                              src={`/heroes/${slot.heroId}.png`}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </span>
                        </HeroHoverCard>
                      ) : (
                        <span className="w-7 h-7 rounded-full overflow-hidden border border-white/10 bg-slate-950/40 flex items-center justify-center" />
                      );
                    })()}
                    <select
                      value={slot.heroId}
                      onChange={(e) =>
                        updateSkillSlot(idx, { heroId: e.target.value })
                      }
                      className="flex-1 px-4 py-2 bg-slate-900/35 glass border border-white/10 rounded-xl text-sm font-bold text-white focus:ring-2 focus:ring-blue-500"
                    >
                      {counterTeam.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-700 shadow-inner">
                    {(["top", "bottom"] as SkillChoice[]).map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => updateSkillSlot(idx, { skill: choice })}
                        className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase ${
                          slot.skill === choice
                            ? "bg-blue-600 text-white shadow-lg"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {choice === "top" ? "TOP" : "BOTTOM"}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeSkillSlot(idx)}
                    className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-rose-300 transition-colors"
                    aria-label="Remove skill"
                    title="Remove"
                  >
                    <svg
                      className="w-5 h-5"
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
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
            Intelligence Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none h-32 resize-none transition-all"
            placeholder={
              type === "success"
                ? "Critical success factors? (e.g. Focus Trude during pain endurance pause)"
                : "What went wrong? (e.g. Team was too slow to react to Colt's bombs)"
            }
          />
        </div>
        <div className="flex flex-col justify-end space-y-6">
          {formError ? (
            <div className="p-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 text-rose-200 text-sm font-bold">
              {formError}
            </div>
          ) : null}
          <div className="flex gap-4">
            <button
              type="submit"
              className={`flex-1 py-4 text-white rounded-xl transition-all font-black uppercase tracking-widest text-sm shadow-2xl hover:scale-[1.02] active:scale-[0.98] ${
                type === "success"
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30"
                  : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
              }`}
            >
              Confirm Log
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default StrategyForm;
