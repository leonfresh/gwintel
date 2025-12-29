-- Create wars table
CREATE TABLE IF NOT EXISTS wars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opponent_name TEXT NOT NULL,
  war_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create war_performances table
CREATE TABLE IF NOT EXISTS war_performances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  war_id UUID REFERENCES wars(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  defense_wins INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_war_performances_war_id ON war_performances(war_id);
CREATE INDEX IF NOT EXISTS idx_war_performances_member_name ON war_performances(member_name);
