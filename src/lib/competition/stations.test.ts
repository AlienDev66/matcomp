import { describe, expect, test } from "bun:test";
import { entriesNeedingWeighIn, upcomingCallQueue } from "./stations";
import type { CompetitionEntry, CompetitionMatch } from "./types";

const entry = (id: string, athlete: string, status: "pending" | "passed" = "pending") =>
  ({
    id,
    competition_id: "c1",
    division_id: "d1",
    athlete_id: athlete,
    seed: null,
    approved: true,
    weigh_in_status: status,
    athlete: { id: athlete, full_name: athlete, academy_id: "a", belt: null, belt_degrees: 0, category: "adult", weight_kg: null, birth_date: null, active: true, user_id: null },
  }) as CompetitionEntry;

const match = (partial: Partial<CompetitionMatch> & { id: string }): CompetitionMatch =>
  ({
    competition_id: "c1",
    division_id: "d1",
    mat_number: 1,
    sort_order: 0,
    status: "queued",
    athlete_a_id: null,
    athlete_b_id: null,
    score_a: 0,
    score_b: 0,
    winner_id: null,
    round_index: 0,
    match_index: 0,
    next_match_id: null,
    next_slot: null,
    ...partial,
  }) as CompetitionMatch;

describe("entriesNeedingWeighIn", () => {
  test("flags urgent when ETA is soon", () => {
    const now = new Date("2026-09-19T12:00:00Z");
    const list = entriesNeedingWeighIn(
      [entry("e1", "ath1"), entry("e2", "ath2", "passed")],
      [
        match({
          id: "m1",
          athlete_a_id: "ath1",
          athlete_b_id: "ath2",
          estimated_start: "2026-09-19T12:10:00Z",
        }),
      ],
      { now, urgentWithinMinutes: 30 },
    );
    expect(list).toHaveLength(1);
    expect(list[0]!.urgent).toBe(true);
  });
});

describe("upcomingCallQueue", () => {
  test("live before queued", () => {
    const q = upcomingCallQueue([
      match({ id: "q", status: "queued", athlete_a_id: "a", estimated_start: "2026-09-19T12:00:00Z" }),
      match({ id: "l", status: "live", athlete_a_id: "b", estimated_start: "2026-09-19T11:00:00Z" }),
    ]);
    expect(q[0]!.id).toBe("l");
  });
});
