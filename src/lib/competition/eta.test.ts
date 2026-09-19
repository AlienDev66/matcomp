import { describe, expect, test } from "bun:test";
import { computeMatEtas } from "./eta";

describe("computeMatEtas", () => {
  const now = new Date("2026-09-19T12:00:00.000Z");

  test("assigns sequential ETAs on a mat queue", () => {
    const assignments = computeMatEtas(
      [
        {
          id: "q1",
          mat_number: 1,
          status: "queued",
          sort_order: 0,
          round_index: 0,
          match_index: 0,
          estimated_start: null,
          clock_seconds: 360,
          clock_running: false,
          clock_updated_at: null,
        },
        {
          id: "q2",
          mat_number: 1,
          status: "queued",
          sort_order: 1,
          round_index: 0,
          match_index: 1,
          estimated_start: null,
          clock_seconds: 360,
          clock_running: false,
          clock_updated_at: null,
        },
      ],
      { now, avgMatchSeconds: 600, gapSeconds: 60 },
    );

    expect(assignments).toHaveLength(2);
    expect(assignments[0]!.matchId).toBe("q1");
    expect(assignments[0]!.estimated_start).toBe(now.toISOString());
    const second = new Date(assignments[1]!.estimated_start).getTime();
    expect(second - now.getTime()).toBe((600 + 60) * 1000);
  });

  test("starts after live clock remaining", () => {
    const assignments = computeMatEtas(
      [
        {
          id: "live",
          mat_number: 2,
          status: "live",
          sort_order: 0,
          round_index: 0,
          match_index: 0,
          estimated_start: now.toISOString(),
          clock_seconds: 120,
          clock_running: false,
          clock_updated_at: null,
        },
        {
          id: "next",
          mat_number: 2,
          status: "queued",
          sort_order: 1,
          round_index: 0,
          match_index: 1,
          estimated_start: null,
          clock_seconds: 360,
          clock_running: false,
          clock_updated_at: null,
        },
      ],
      { now, avgMatchSeconds: 300, gapSeconds: 30 },
    );

    const next = assignments.find((a) => a.matchId === "next");
    expect(next).toBeTruthy();
    expect(new Date(next!.estimated_start).getTime() - now.getTime()).toBe((120 + 30) * 1000);
  });
});
