import { describe, expect, test } from "bun:test";
import {
  assertBracketLinksResolve,
  planBracket,
  planDoubleElimination,
  planRoundRobin,
  planSingleElimConsolation,
  planSingleElimination,
} from "./bracket";

describe("planSingleElimination", () => {
  test("requires 2+ athletes", () => {
    expect(() => planSingleElimination(["a"])).toThrow();
  });

  test("pads to power of two with BYEs", () => {
    const plan = planSingleElimination(["a", "b", "c"]);
    const r0 = plan.filter((m) => m.roundIndex === 0);
    expect(r0).toHaveLength(2);
    expect(r0.some((m) => m.isBye)).toBe(true);
  });

  test("4 athletes → 3 matches", () => {
    const plan = planSingleElimination(["a", "b", "c", "d"]);
    expect(plan).toHaveLength(3);
  });
});

describe("planRoundRobin", () => {
  test("n athletes → n*(n-1)/2 matches", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const plan = planRoundRobin(ids);
    expect(plan).toHaveLength(10);
    expect(plan.every((m) => m.bracketSide === "rr")).toBe(true);
  });
});

describe("planSingleElimConsolation", () => {
  test("adds bronze match for 4+", () => {
    const plan = planSingleElimConsolation(["a", "b", "c", "d"]);
    expect(plan.some((m) => m.bracketSide === "consolation")).toBe(true);
    const semis = plan.filter((m) => m.roundIndex === 0);
    expect(semis.every((m) => m.loserNextMatchKey)).toBe(true);
  });
});

describe("planDoubleElimination", () => {
  test("includes winners, losers and grand final", () => {
    const plan = planDoubleElimination(["a", "b", "c", "d"]);
    expect(plan.some((m) => m.bracketSide === "winners")).toBe(true);
    expect(plan.some((m) => m.bracketSide === "losers")).toBe(true);
    expect(plan.some((m) => m.bracketSide === "grand_final")).toBe(true);
    assertBracketLinksResolve(plan);
  });

  test("8 athletes: all links resolve", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const plan = planDoubleElimination(ids);
    assertBracketLinksResolve(plan);
    expect(plan.filter((m) => m.bracketSide === "winners")).toHaveLength(7);
    expect(plan.filter((m) => m.bracketSide === "losers")).toHaveLength(6);
    expect(plan.filter((m) => m.bracketSide === "grand_final")).toHaveLength(1);
  });

  test("2 athletes: single grand final", () => {
    const plan = planDoubleElimination(["a", "b"]);
    expect(plan).toHaveLength(1);
    expect(plan[0]!.bracketSide).toBe("grand_final");
  });
});

describe("planBracket", () => {
  test("dispatches formats", () => {
    expect(planBracket("round_robin", ["a", "b", "c"])).toHaveLength(3);
    expect(planBracket("single_elim", ["a", "b", "c", "d"])).toHaveLength(3);
  });
});
