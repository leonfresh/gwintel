import React from "react";
import type { Hero } from "../types";

function getTierGradientClass(tier: string) {
  if (tier.includes("SSS")) return "from-yellow-400 to-orange-600 text-white";
  if (tier.includes("SS")) return "from-purple-500 to-indigo-700 text-white";
  if (tier.includes("S")) return "from-blue-500 to-blue-700 text-white";
  return "from-slate-600 to-slate-800 text-slate-300";
}

function abilityTags(hero: Hero): string[] {
  if (!hero.ability) return [];
  return hero.ability
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function HeroHoverCard({
  hero,
  children,
  maxTags = 18,
}: {
  hero: Hero;
  children: React.ReactNode;
  maxTags?: number;
}) {
  const tags = abilityTags(hero).slice(0, maxTags);

  return (
    <div className="relative inline-block group">
      {children}

      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-[300] w-[min(420px,86vw)] opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-150">
        <div className="rounded-2xl border border-white/10 bg-slate-950/80 glass shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="text-sm font-black text-white truncate">
              {hero.name}
            </div>
            <div
              className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-black bg-gradient-to-br ${getTierGradientClass(
                hero.tier
              )} border border-white/10`}
            >
              {hero.tier}
            </div>
          </div>

          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {tags.length === 0 ? (
                <span className="text-xs font-bold text-slate-400">
                  No abilities listed.
                </span>
              ) : (
                tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-1 rounded-lg border border-white/10 bg-slate-900/30 glass text-[10px] font-black text-slate-200"
                  >
                    {t}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto w-3 h-3 rotate-45 -mt-1 border-r border-b border-white/10 bg-slate-950/80" />
      </div>
    </div>
  );
}
