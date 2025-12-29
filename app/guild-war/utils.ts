import { WarPerformance } from "@/types";

export interface MemberStats {
  member_name: string;
  total_wars: number;
  total_wins: number;
  total_losses: number;
  total_def_wins: number;
  win_rate: number;
  avg_def_wins: number;
  titles: string[];
  tier: "Top" | "Mid" | "Low";
}

export const calculateStats = (performances: WarPerformance[]): MemberStats[] => {
  const memberMap = new Map<string, {
    wins: number;
    losses: number;
    def_wins: number;
    wars: number;
  }>();

  performances.forEach((p) => {
    const current = memberMap.get(p.member_name) || { wins: 0, losses: 0, def_wins: 0, wars: 0 };
    memberMap.set(p.member_name, {
      wins: current.wins + p.wins,
      losses: current.losses + p.losses,
      def_wins: current.def_wins + p.defense_wins,
      wars: current.wars + 1,
    });
  });

  const stats: MemberStats[] = Array.from(memberMap.entries()).map(([name, data]) => {
    const total_attacks = data.wins + data.losses;
    const win_rate = total_attacks > 0 ? (data.wins / total_attacks) * 100 : 0;
    const avg_def_wins = data.wars > 0 ? data.def_wins / data.wars : 0;

    return {
      member_name: name,
      total_wars: data.wars,
      total_wins: data.wins,
      total_losses: data.losses,
      total_def_wins: data.def_wins,
      win_rate,
      avg_def_wins,
      titles: [],
      tier: "Mid", // Default
    };
  });

  // Assign Titles and Tiers
  return stats.map((s) => {
    const titles: string[] = [];
    let tier: "Top" | "Mid" | "Low" = "Mid";

    // Titles Logic
    if (s.win_rate === 100 && s.total_wins >= 5) titles.push("Unbeaten Attacker");
    if (s.avg_def_wins >= 5) titles.push("Fortress Defense");
    if (s.avg_def_wins >= 3 && s.avg_def_wins < 5) titles.push("Solid Defense");
    if (s.win_rate >= 60 && s.avg_def_wins >= 2) titles.push("Balanced Defender");
    if (s.win_rate >= 80) titles.push("Strong Contributor");
    if (s.total_wins === 0 && s.total_losses > 0) titles.push("Needs Training");
    if (s.total_def_wins === 0 && s.total_wars >= 3) titles.push("Open Gate");

    // Tier Logic
    if (s.win_rate >= 80 || (s.win_rate >= 60 && s.avg_def_wins >= 4)) {
      tier = "Top";
    } else if (s.win_rate < 40 && s.avg_def_wins < 2) {
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
