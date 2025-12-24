import React, { createContext, useContext, useMemo, useState } from "react";

type HeroHoverContextValue = {
  openKey: string | null;
  setOpenKey: React.Dispatch<React.SetStateAction<string | null>>;
};

const HeroHoverContext = createContext<HeroHoverContextValue | null>(null);

export function HeroHoverProvider({ children }: { children: React.ReactNode }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const value = useMemo(() => ({ openKey, setOpenKey }), [openKey]);

  return (
    <HeroHoverContext.Provider value={value}>
      {children}
    </HeroHoverContext.Provider>
  );
}

export function useHeroHover() {
  const ctx = useContext(HeroHoverContext);
  if (!ctx) {
    return {
      openKey: null as string | null,
      setOpenKey: () => {},
    };
  }
  return ctx;
}
