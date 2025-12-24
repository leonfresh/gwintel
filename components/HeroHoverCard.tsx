import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Hero } from "../types";
import { useHeroHover } from "./HeroHoverProvider";

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
  const reactId = useId();
  const hoverKey = useMemo(() => `${hero.id}::${reactId}`, [hero.id, reactId]);
  const { openKey, setOpenKey } = useHeroHover();
  const open = openKey === hoverKey;

  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    placement: "top" | "bottom";
  } | null>(null);

  const tags = abilityTags(hero).slice(0, maxTags);

  const updatePosition = () => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const preferTopY = rect.top - 12;
    const shouldFlip = preferTopY < 16;
    const placement: "top" | "bottom" = shouldFlip ? "bottom" : "top";

    setPos({
      left: centerX,
      top: shouldFlip ? rect.bottom + 12 : rect.top - 12,
      placement,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <span
      ref={anchorRef}
      className="inline-block"
      onMouseEnter={() => setOpenKey(hoverKey)}
      onMouseLeave={() => setOpenKey((k) => (k === hoverKey ? null : k))}
      onFocus={() => setOpenKey(hoverKey)}
      onBlur={() => setOpenKey((k) => (k === hoverKey ? null : k))}
    >
      {children}

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed left-0 top-0 z-[9999]"
              style={{
                transform: "translate(-50%, 0)",
                left: `${pos.left}px`,
                top: `${pos.top}px`,
              }}
            >
              <div
                className={`w-[min(420px,86vw)] transition-all duration-150 ${
                  pos.placement === "top"
                    ? "-translate-y-full opacity-100"
                    : "opacity-100"
                }`}
              >
                <div className="rounded-2xl border border-white/10 bg-slate-950/85 glass shadow-2xl overflow-hidden">
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

                <div
                  className={`mx-auto w-3 h-3 rotate-45 -mt-1 border-r border-b border-white/10 bg-slate-950/85 ${
                    pos.placement === "bottom" ? "hidden" : ""
                  }`}
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
