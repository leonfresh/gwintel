import { WarPerformance } from "@/types";

export interface MemberStats {
  member_name: string;
  total_wars: number;
  total_wins: number;
  total_losses: number;
  total_def_wins: number;
  win_rate: number;
  avg_def_wins: number;
  missed_attacks: number;
  participation_rate: number;
  titles: string[];
  tier: "Top" | "Mid" | "Low";
}

export const calculateStats = (
  performances: WarPerformance[]
): MemberStats[] => {
  const normalizeDisplayName = (name: string) =>
    name.trim().replace(/\s+/g, " ");
  const normalizeKey = (name: string) =>
    normalizeDisplayName(name).toLowerCase();

  const memberMap = new Map<
    string,
    {
      displayNameCounts: Map<string, number>;
      wins: number;
      losses: number;
      def_wins: number;
      warIds: Set<string>;
    }
  >();

  performances.forEach((p) => {
    const rawName = typeof p.member_name === "string" ? p.member_name : "";
    const displayName = normalizeDisplayName(rawName);
    if (!displayName) return;
    const key = normalizeKey(displayName);

    const current = memberMap.get(key) || {
      displayNameCounts: new Map<string, number>(),
      wins: 0,
      losses: 0,
      def_wins: 0,
      warIds: new Set<string>(),
    };

    current.wins += p.wins;
    current.losses += p.losses;
    current.def_wins += p.defense_wins;
    if (typeof p.war_id === "string" && p.war_id) current.warIds.add(p.war_id);
    current.displayNameCounts.set(
      displayName,
      (current.displayNameCounts.get(displayName) ?? 0) + 1
    );

    memberMap.set(key, current);
  });

  const pickDisplayName = (counts: Map<string, number>) => {
    const entries = Array.from(counts.entries());
    if (entries.length === 0) return "Unknown";
    entries.sort(
      (a, b) =>
        b[1] - a[1] ||
        a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
    );
    return entries[0][0];
  };

  const stats: MemberStats[] = Array.from(memberMap.entries()).map(
    ([, data]) => {
      const wars = data.warIds.size;
      const total_attacks = data.wins + data.losses;
      const expected_attacks = wars * 5; // 5 attacks per war
      const missed_attacks = Math.max(0, expected_attacks - total_attacks);
      const participation_rate =
        expected_attacks > 0 ? (total_attacks / expected_attacks) * 100 : 0;
      const win_rate =
        total_attacks > 0 ? (data.wins / total_attacks) * 100 : 0;
      const avg_def_wins = wars > 0 ? data.def_wins / wars : 0;

      return {
        member_name: pickDisplayName(data.displayNameCounts),
        total_wars: wars,
        total_wins: data.wins,
        total_losses: data.losses,
        total_def_wins: data.def_wins,
        win_rate,
        avg_def_wins,
        missed_attacks,
        participation_rate,
        titles: [],
        tier: "Mid", // Default
      };
    }
  );

  // Assign Titles and Tiers
  return stats.map((s) => {
    const titles: string[] = [];
    let tier: "Top" | "Mid" | "Low" = "Mid";

    const total_attacks = s.total_wins + s.total_losses;

    // Titles Logic (Attack)
    if (s.win_rate === 100 && s.total_wins >= 5)
      titles.push("Unbeaten Attacker");
    if (s.win_rate >= 95 && total_attacks >= 10)
      titles.push("Flawless Striker");
    if (s.win_rate >= 90 && total_attacks >= 15) titles.push("Ace Attacker");
    if (s.win_rate >= 80 && total_attacks >= 20)
      titles.push("Consistent Attacker");
    if (s.total_wins >= 25) titles.push("War Machine");
    if (s.total_wins >= 15 && s.total_losses <= 5)
      titles.push("Clean Finisher");
    if (total_attacks >= 30) titles.push("High Volume Attacker");
    if (s.total_wins >= 10 && s.total_wins >= s.total_losses * 2)
      titles.push("Dominant Offense");

    // Titles Logic (Defense)
    if (s.avg_def_wins >= 6) titles.push("Iron Fortress");
    else if (s.avg_def_wins >= 5) titles.push("Fortress Defense");
    else if (s.avg_def_wins >= 3) titles.push("Solid Defense");

    // Titles Logic (Balanced)
    if (s.win_rate >= 65 && s.avg_def_wins >= 2)
      titles.push("Balanced Defender");
    if (s.win_rate >= 80 && s.avg_def_wins >= 3)
      titles.push("All-Rounder Elite");
    if (s.win_rate >= 80) titles.push("Strong Contributor");

    // Titles Logic (Negative)
    if (s.total_wins === 0 && s.total_losses > 0) titles.push("Needs Training");
    if (s.win_rate < 35 && total_attacks >= 10) titles.push("Attack Liability");
    if (s.total_losses >= 15) titles.push("Bleeding Attacks");
    if (s.total_def_wins === 0 && s.total_wars >= 3) titles.push("Open Gate");

    // Titles Logic (Inactivity)
    if (s.participation_rate < 20 && s.total_wars >= 3)
      titles.push("Ghost Member");
    else if (s.participation_rate < 40 && s.total_wars >= 3)
      titles.push("AFK Warrior");
    else if (s.participation_rate < 60 && s.total_wars >= 3)
      titles.push("Part-Timer");
    if (s.missed_attacks >= 20) titles.push("Serial Skipper");
    if (s.missed_attacks >= s.total_wars * 4 && s.total_wars >= 3)
      titles.push("Bench Warmer");
    if (total_attacks === 0 && s.total_wars >= 2) titles.push("MIA");

    // Tier Logic
    if (s.win_rate >= 85 || (s.win_rate >= 70 && s.avg_def_wins >= 4)) {
      tier = "Top";
    } else if (s.win_rate < 40 && s.avg_def_wins < 2) {
      tier = "Low";
    }

    // Inactivity penalty: force Low tier if participation is terrible
    if (s.participation_rate < 30 && s.total_wars >= 3) {
      tier = "Low";
    }

    // Fallback title if none
    if (titles.length === 0) {
      if (tier === "Top") titles.push("Elite Knight");
      if (tier === "Mid") titles.push("Knight");
      if (tier === "Low") titles.push("Recruit");
    }

    return { ...s, titles, tier };
  });
};
