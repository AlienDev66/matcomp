import type { CompetitionEntry, CompetitionMatch } from "./types";

export type AthleteCallStatus = "none" | "warmup" | "mat" | "holding" | "done";

export type PodiumMedal = "gold" | "silver" | "bronze";
export type PodiumCallStatus = "pending" | "called" | "done" | "skipped";

export type PodiumCall = {
  id: string;
  competition_id: string;
  division_id: string;
  athlete_id: string;
  medal: PodiumMedal;
  status: PodiumCallStatus;
  called_at?: string | null;
  done_at?: string | null;
  created_at?: string;
  athlete?: { id: string; full_name: string } | null;
};

export const CALL_STATUS_LABEL: Record<AthleteCallStatus, string> = {
  none: "—",
  warmup: "Aquecimento",
  mat: "Tatâmi",
  holding: "Espera",
  done: "OK",
};

export const PODIUM_MEDAL_LABEL: Record<PodiumMedal, string> = {
  gold: "Ouro",
  silver: "Prata",
  bronze: "Bronze",
};

/** Entries still needing weigh-in, optionally flagged urgent if fight ETA is soon. */
export function entriesNeedingWeighIn(
  entries: CompetitionEntry[],
  matches: CompetitionMatch[],
  opts?: { urgentWithinMinutes?: number; now?: Date },
) {
  const within = (opts?.urgentWithinMinutes ?? 30) * 60 * 1000;
  const now = opts?.now ?? new Date();

  const athleteIdsUrgent = new Set<string>();
  for (const m of matches) {
    if (m.status !== "queued" && m.status !== "live") continue;
    if (!m.estimated_start) continue;
    const eta = new Date(m.estimated_start).getTime();
    if (eta - now.getTime() > within) continue;
    if (m.athlete_a_id) athleteIdsUrgent.add(m.athlete_a_id);
    if (m.athlete_b_id) athleteIdsUrgent.add(m.athlete_b_id);
  }

  return entries
    .filter((e) => (e.weigh_in_status ?? "pending") === "pending" && e.approved !== false)
    .map((e) => ({
      entry: e,
      urgent: athleteIdsUrgent.has(e.athlete_id),
      nextEta: nextEtaForAthlete(matches, e.athlete_id),
    }))
    .sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return (a.nextEta ?? "9999").localeCompare(b.nextEta ?? "9999");
    });
}

function nextEtaForAthlete(matches: CompetitionMatch[], athleteId: string) {
  const next = matches
    .filter(
      (m) =>
        (m.status === "queued" || m.status === "live") &&
        (m.athlete_a_id === athleteId || m.athlete_b_id === athleteId),
    )
    .sort((a, b) => (a.estimated_start ?? "").localeCompare(b.estimated_start ?? ""))[0];
  return next?.estimated_start ?? null;
}

export function weighInForAthlete(
  entries: CompetitionEntry[],
  athleteId: string | null | undefined,
) {
  if (!athleteId) return null;
  const e = entries.find((x) => x.athlete_id === athleteId);
  return e?.weigh_in_status ?? null;
}

/** Upcoming matches for the caller board, soonest first. */
export function upcomingCallQueue(matches: CompetitionMatch[], limit = 24) {
  return matches
    .filter((m) => m.status === "queued" || m.status === "live")
    .filter((m) => m.athlete_a_id || m.athlete_b_id)
    .sort((a, b) => {
      if (a.status === "live" && b.status !== "live") return -1;
      if (b.status === "live" && a.status !== "live") return 1;
      return (a.estimated_start ?? "9999").localeCompare(b.estimated_start ?? "9999");
    })
    .slice(0, limit);
}
