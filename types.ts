
export type HeroTier = 'SSS' | 'SS' | 'S+' | 'S' | 'A+' | 'A' | 'B' | 'C' | 'D';

export interface Hero {
  id: string;
  name: string;
  ability: string;
  attackType: string;
  range: string;
  tier: HeroTier;
}

export type LogType = 'success' | 'fail';

export interface StrategyLog {
  id: string;
  enemyTeam: string[]; // Hero IDs
  counterTeam: string[]; // Hero IDs
  type: LogType;
  notes: string;
  votes: number;
  author: string; // email (derived from Supabase login)
  createdAt: number;
}
