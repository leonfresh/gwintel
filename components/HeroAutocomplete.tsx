import React, { useState, useRef, useEffect } from "react";
import { AUTOCOMPLETE_DATABASE } from "../constants";
import { Hero } from "../types";

interface Props {
  onSelect: (hero: Hero) => void;
  placeholder?: string;
  className?: string;
}

const HeroAutocomplete: React.FC<Props> = ({
  onSelect,
  placeholder = "Search hero...",
  className = "",
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hero[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length > 0) {
      const filtered = AUTOCOMPLETE_DATABASE.filter((h) =>
        h.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8);
      setResults(filtered);
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleHeroSelect = (hero: Hero) => {
    onSelect(hero);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
      />
      {isOpen && results.length > 0 && (
        <div className="absolute z-[80] mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {results.map((hero) => (
            <button
              key={hero.id}
              onClick={() => handleHeroSelect(hero)}
              className="w-full text-left px-4 py-3 hover:bg-slate-700 border-b border-slate-700/50 last:border-none flex justify-between items-center transition-colors"
            >
              <div>
                <span className="font-medium text-slate-100">{hero.name}</span>
                <span className="ml-2 text-xs text-slate-400 capitalize">
                  {hero.attackType}
                </span>
              </div>
              <span
                className={`text-xs font-bold px-2 py-1 rounded bg-slate-900 ${
                  hero.tier.includes("OP")
                    ? "text-fuchsia-300"
                    :
                  hero.tier.includes("SSS")
                    ? "text-yellow-400"
                    : hero.tier.includes("SS")
                    ? "text-purple-400"
                    : "text-blue-400"
                }`}
              >
                {hero.tier}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default HeroAutocomplete;
