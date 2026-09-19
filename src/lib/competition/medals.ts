import type { CompetitionMatch } from "./types";
import { roundLabel } from "./bracket";

export type Medal = "gold" | "silver" | "bronze";

export type DivisionMedalists = {
  divisionId: string;
  gold: { athleteId: string; name: string } | null;
  silver: { athleteId: string; name: string } | null;
  bronze: { athleteId: string; name: string }[];
};

function athleteName(m: CompetitionMatch, id: string | null) {
  if (!id) return "—";
  if (m.athlete_a_id === id) return m.athlete_a?.full_name ?? id.slice(0, 8);
  if (m.athlete_b_id === id) return m.athlete_b?.full_name ?? id.slice(0, 8);
  return id.slice(0, 8);
}

/** Derive gold/silver/bronze from finished single-elim matches. */
export function deriveMedals(matches: CompetitionMatch[]): DivisionMedalists[] {
  const byDiv = new Map<string, CompetitionMatch[]>();
  for (const m of matches) {
    if (!m.division_id) continue;
    const list = byDiv.get(m.division_id) ?? [];
    list.push(m);
    byDiv.set(m.division_id, list);
  }

  const out: DivisionMedalists[] = [];
  for (const [divisionId, divMatches] of byDiv) {
    const maxRound = Math.max(...divMatches.map((m) => m.round_index), 0);
    const final = divMatches.find((m) => m.round_index === maxRound && m.status === "finished");
    const semis = divMatches.filter((m) => m.round_index === maxRound - 1 && m.status === "finished");

    let gold: DivisionMedalists["gold"] = null;
    let silver: DivisionMedalists["silver"] = null;
    const bronze: DivisionMedalists["bronze"] = [];

    if (final?.winner_id) {
      gold = { athleteId: final.winner_id, name: athleteName(final, final.winner_id) };
      const loserId =
        final.athlete_a_id === final.winner_id ? final.athlete_b_id : final.athlete_a_id;
      if (loserId) {
        silver = { athleteId: loserId, name: athleteName(final, loserId) };
      }
    }

    for (const semi of semis) {
      if (!semi.winner_id) continue;
      const loserId =
        semi.athlete_a_id === semi.winner_id ? semi.athlete_b_id : semi.athlete_a_id;
      if (loserId) {
        bronze.push({ athleteId: loserId, name: athleteName(semi, loserId) });
      }
    }

    out.push({ divisionId, gold, silver, bronze });
  }
  return out;
}

export function medalTotals(medalists: DivisionMedalists[]) {
  return {
    gold: medalists.filter((m) => m.gold).length,
    silver: medalists.filter((m) => m.silver).length,
    bronze: medalists.reduce((n, m) => n + m.bronze.length, 0),
  };
}

export function matchRoundLabel(matches: CompetitionMatch[], m: CompetitionMatch) {
  const same = matches.filter((x) => x.division_id === m.division_id);
  const totalRounds = Math.max(...same.map((x) => x.round_index), 0) + 1;
  return roundLabel(m.round_index, totalRounds);
}
