import React, { useState } from "react";
import { Hero } from "../types";

interface HeroAvatarProps {
  hero: Hero;
  size?: "sm" | "md" | "lg";
  showTier?: boolean;
}

const HeroAvatar: React.FC<HeroAvatarProps> = ({
  hero,
  size = "md",
  showTier = false,
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: "w-12 h-12 text-[10px]",
    md: "w-16 h-16 text-xs",
    lg: "w-20 h-20 text-sm",
  };

  const tierSizeClasses = {
    sm: "text-[8px] px-1 py-0.5",
    md: "text-[10px] px-1.5 py-0.5",
    lg: "text-xs px-2 py-1",
  };

  const getTierColor = (tier: string) => {
    if (tier.includes("SSS")) return "from-yellow-400 to-orange-600 text-white";
    if (tier.includes("SS")) return "from-purple-500 to-indigo-700 text-white";
    if (tier.includes("S")) return "from-blue-500 to-blue-700 text-white";
    return "from-slate-600 to-slate-800 text-slate-300";
  };

  return (
    <div className="relative inline-block">
      <div
        className={`${
          sizeClasses[size]
        } rounded-full bg-slate-800 border-2 flex items-center justify-center overflow-hidden transition-all hover:scale-110 ${
          hero.attackType === "Magic"
            ? "border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
            : "border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
        }`}
      >
        {!imageError ? (
          <img
            src={`/heroes/${hero.id}.png`}
            alt={hero.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span className="text-white font-black text-center leading-none px-1">
            {hero.name}
          </span>
        )}
      </div>
      {showTier && (
        <div
          className={`absolute -bottom-1 -right-1 ${
            tierSizeClasses[size]
          } rounded-md font-black bg-gradient-to-br ${getTierColor(
            hero.tier
          )} border border-white/10 shadow-lg`}
        >
          {hero.tier}
        </div>
      )}
    </div>
  );
};

export default HeroAvatar;
