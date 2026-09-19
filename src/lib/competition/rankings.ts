import { supabase } from "@/integrations/supabase/client";
import type { RankingRow, RankingSeason } from "./types";
import { deriveMedals } from "./medals";
import { fetchMatches } from "./api";

export async function fetchRankingSeasons() {
  const { data, error } = await supabase
    .from("ranking_seasons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RankingSeason[];
}

export async function fetchRankingRows(seasonId: string) {
  const { data, error } = await supabase
    .from("ranking_rows")
    .select("*, athlete:athletes(*, academies(id, name, slug, city, affiliation))")
    .eq("season_id", seasonId)
    .order("points", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any, i: number) => ({
    ...row,
    rank: row.rank ?? i + 1,
    athlete: row.athlete
      ? { ...row.athlete, academy: row.athlete.academies ?? null }
      : null,
  })) as RankingRow[];
}

const POINTS = { gold: 10, silver: 6, bronze: 3, win: 1 };

/** Recalc season points from finished competitions' medals + match W/L. */
export async function recalcRankingSeason(seasonId: string) {
  const { data: comps, error: cErr } = await supabase
    .from("competitions")
    .select("id, federation_approval")
    .eq("status", "finished");
  if (cErr) throw cErr;

  // Rankings only count finished events that are federation-approved (or none = open).
  const eligible = (comps ?? []).filter((c: { federation_approval?: string | null }) => {
    const a = c.federation_approval ?? "none";
    return a === "approved" || a === "none";
  });

  const agg = new Map<
    string,
    { points: number; wins: number; losses: number; gold: number; silver: number; bronze: number }
  >();

  const bump = (athleteId: string, patch: Partial<(typeof agg extends Map<string, infer V> ? V : never)>) => {
    const cur = agg.get(athleteId) ?? {
      points: 0,
      wins: 0,
      losses: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
    };
    agg.set(athleteId, {
      points: cur.points + (patch.points ?? 0),
      wins: cur.wins + (patch.wins ?? 0),
      losses: cur.losses + (patch.losses ?? 0),
      gold: cur.gold + (patch.gold ?? 0),
      silver: cur.silver + (patch.silver ?? 0),
      bronze: cur.bronze + (patch.bronze ?? 0),
    });
  };

  for (const c of eligible) {
    const matches = await fetchMatches(c.id);
    for (const m of matches) {
      if (m.status !== "finished" || !m.winner_id) continue;
      bump(m.winner_id, { wins: 1, points: POINTS.win });
      const loser =
        m.athlete_a_id === m.winner_id ? m.athlete_b_id : m.athlete_a_id;
      if (loser) bump(loser, { losses: 1 });
    }
    for (const row of deriveMedals(matches)) {
      if (row.gold) bump(row.gold.athleteId, { gold: 1, points: POINTS.gold });
      if (row.silver) bump(row.silver.athleteId, { silver: 1, points: POINTS.silver });
      for (const b of row.bronze) bump(b.athleteId, { bronze: 1, points: POINTS.bronze });
    }
  }

  await supabase.from("ranking_rows").delete().eq("season_id", seasonId);

  const rows = [...agg.entries()]
    .sort((a, b) => b[1].points - a[1].points)
    .map(([athlete_id, stats], i) => ({
      season_id: seasonId,
      athlete_id,
      ...stats,
      rank: i + 1,
    }));

  if (rows.length) {
    const { error } = await supabase.from("ranking_rows").insert(rows as never);
    if (error) throw error;
  }

  await supabase
    .from("ranking_seasons")
    .update({ last_calculated_at: new Date().toISOString() } as never)
    .eq("id", seasonId);

  return fetchRankingRows(seasonId);
}
