import type { CompetitionMatch } from "./types";

export type EtaOptions = {
  /** Average fight duration including stoppages (default 6 min). */
  avgMatchSeconds?: number;
  /** Gap between fights on the same mat (default 90s). */
  gapSeconds?: number;
  /** Clock now (injectable for tests). */
  now?: Date;
};

export type EtaAssignment = { matchId: string; estimated_start: string };

/**
 * Compute ETA per queued match from current live clocks + queue order per tatâmi.
 * Live matches keep their existing estimated_start (or now). Finished are skipped.
 */
export function computeMatEtas(
  matches: Pick<
    CompetitionMatch,
    | "id"
    | "mat_number"
    | "status"
    | "sort_order"
    | "round_index"
    | "match_index"
    | "estimated_start"
    | "clock_seconds"
    | "clock_running"
    | "clock_updated_at"
  >[],
  opts: EtaOptions = {},
): EtaAssignment[] {
  const avg = opts.avgMatchSeconds ?? 6 * 60;
  const gap = opts.gapSeconds ?? 90;
  const now = opts.now ?? new Date();

  const byMat = new Map<number, typeof matches>();
  for (const m of matches) {
    const mat = m.mat_number || 1;
    const list = byMat.get(mat) ?? [];
    list.push(m);
    byMat.set(mat, list);
  }

  const out: EtaAssignment[] = [];

  for (const [, list] of byMat) {
    const ordered = [...list].sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.round_index - b.round_index ||
        a.match_index - b.match_index,
    );

    const live = ordered.find((m) => m.status === "live");
    let cursorMs = now.getTime();

    if (live) {
      const remaining = remainingClockSeconds(live, now);
      cursorMs = now.getTime() + Math.max(0, remaining) * 1000 + gap * 1000;
      if (live.estimated_start) {
        // keep live's stamp; don't overwrite
      } else {
        out.push({ matchId: live.id, estimated_start: now.toISOString() });
      }
    }

    const queued = ordered.filter((m) => m.status === "queued");
    for (const m of queued) {
      out.push({ matchId: m.id, estimated_start: new Date(cursorMs).toISOString() });
      cursorMs += (avg + gap) * 1000;
    }
  }

  return out;
}

function remainingClockSeconds(
  m: Pick<CompetitionMatch, "clock_seconds" | "clock_running" | "clock_updated_at">,
  now: Date,
): number {
  let sec = m.clock_seconds ?? 6 * 60;
  if (m.clock_running && m.clock_updated_at) {
    const elapsed = (now.getTime() - new Date(m.clock_updated_at).getTime()) / 1000;
    sec = Math.max(0, sec - elapsed);
  }
  return sec;
}
