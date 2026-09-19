/** Bracket planners (pure, testable). */

export type BracketSeed = string | null;

export type BracketFormat =
  | "single_elim"
  | "double_elim"
  | "round_robin"
  | "single_elim_consolation";

export type BracketSide = "winners" | "losers" | "consolation" | "rr" | "grand_final";

export type PlannedMatch = {
  roundIndex: number;
  matchIndex: number;
  athleteAId: string | null;
  athleteBId: string | null;
  nextMatchKey: string | null;
  nextSlot: "a" | "b" | null;
  key: string;
  bracketSide?: BracketSide;
  isBye?: boolean;
  loserNextMatchKey?: string | null;
  loserNextSlot?: "a" | "b" | null;
};

export const BRACKET_FORMAT_LABEL: Record<BracketFormat, string> = {
  single_elim: "Eliminação simples",
  double_elim: "Eliminação dupla",
  round_robin: "Todos contra todos",
  single_elim_consolation: "Eliminação + 3º lugar",
};

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function seedAthletes(ids: string[]): BracketSeed[] {
  const size = nextPowerOfTwo(Math.max(ids.length, 2));
  const seeds: BracketSeed[] = [...ids];
  while (seeds.length < size) seeds.push(null);
  return seeds;
}

function withByeFlag(m: PlannedMatch): PlannedMatch {
  const isBye =
    (m.athleteAId == null && m.athleteBId != null) ||
    (m.athleteBId == null && m.athleteAId != null);
  return { ...m, isBye: !!isBye, bracketSide: m.bracketSide ?? "winners" };
}

/** Single-elimination. Round 0 = first round; BYEs marked explicitly. */
export function planSingleElimination(athleteIds: string[]): PlannedMatch[] {
  if (athleteIds.length < 2) {
    throw new Error("São precisos pelo menos 2 atletas para gerar a chave.");
  }

  const seeds = seedAthletes(athleteIds);
  const size = seeds.length;
  const totalRounds = Math.log2(size);
  const planned: PlannedMatch[] = [];

  const round0Count = size / 2;
  for (let i = 0; i < round0Count; i++) {
    const a = seeds[i * 2] ?? null;
    const b = seeds[i * 2 + 1] ?? null;
    planned.push(
      withByeFlag({
        key: `0:${i}`,
        roundIndex: 0,
        matchIndex: i,
        athleteAId: a,
        athleteBId: b,
        nextMatchKey: totalRounds > 1 ? `1:${Math.floor(i / 2)}` : null,
        nextSlot: totalRounds > 1 ? (i % 2 === 0 ? "a" : "b") : null,
        bracketSide: "winners",
      }),
    );
  }

  let matchesInRound = round0Count / 2;
  for (let r = 1; r < totalRounds; r++) {
    for (let i = 0; i < matchesInRound; i++) {
      const isFinal = r === totalRounds - 1;
      planned.push({
        key: `${r}:${i}`,
        roundIndex: r,
        matchIndex: i,
        athleteAId: null,
        athleteBId: null,
        nextMatchKey: isFinal ? null : `${r + 1}:${Math.floor(i / 2)}`,
        nextSlot: isFinal ? null : i % 2 === 0 ? "a" : "b",
        bracketSide: "winners",
        isBye: false,
      });
    }
    matchesInRound /= 2;
  }

  return planned;
}

/**
 * Single-elim + bronze match (losers of semis → consolation).
 */
export function planSingleElimConsolation(athleteIds: string[]): PlannedMatch[] {
  const planned = planSingleElimination(athleteIds);
  const maxRound = Math.max(...planned.map((p) => p.roundIndex));
  if (maxRound < 1) return planned; // only final — no semis

  const semiRound = maxRound - 1;
  const semis = planned.filter((p) => p.roundIndex === semiRound);
  if (semis.length < 2) return planned;

  const consolKey = `c:0:0`;
  for (let i = 0; i < semis.length; i++) {
    const s = semis[i]!;
    const idx = planned.findIndex((p) => p.key === s.key);
    planned[idx] = {
      ...s,
      loserNextMatchKey: consolKey,
      loserNextSlot: i % 2 === 0 ? "a" : "b",
    };
  }

  planned.push({
    key: consolKey,
    roundIndex: maxRound + 1,
    matchIndex: 0,
    athleteAId: null,
    athleteBId: null,
    nextMatchKey: null,
    nextSlot: null,
    bracketSide: "consolation",
    isBye: false,
  });

  return planned;
}

/** Round-robin: every athlete vs every other. */
export function planRoundRobin(athleteIds: string[]): PlannedMatch[] {
  if (athleteIds.length < 2) {
    throw new Error("São precisos pelo menos 2 atletas para gerar a chave.");
  }
  const planned: PlannedMatch[] = [];
  let idx = 0;
  for (let i = 0; i < athleteIds.length; i++) {
    for (let j = i + 1; j < athleteIds.length; j++) {
      planned.push({
        key: `rr:0:${idx}`,
        roundIndex: 0,
        matchIndex: idx,
        athleteAId: athleteIds[i]!,
        athleteBId: athleteIds[j]!,
        nextMatchKey: null,
        nextSlot: null,
        bracketSide: "rr",
        isBye: false,
      });
      idx += 1;
    }
  }
  return planned;
}

/**
 * Double-elimination (power-of-2), IBJJF-style wiring:
 * winners bracket + full losers bracket (drop-in + consolidation) + grand final.
 * Note: no “reset” / second GF if the losers-bracket winner takes the first GF —
 * that remains a future polish for full IBJJF reset finals.
 */
export function planDoubleElimination(athleteIds: string[]): PlannedMatch[] {
  if (athleteIds.length < 2) {
    throw new Error("São precisos pelo menos 2 atletas para gerar a chave.");
  }

  const seeds = seedAthletes(athleteIds);
  const size = seeds.length;

  // 2 athletes: single decisive match (no meaningful losers bracket)
  if (size === 2) {
    return [
      withByeFlag({
        key: "gf:0:0",
        roundIndex: 0,
        matchIndex: 0,
        athleteAId: seeds[0] ?? null,
        athleteBId: seeds[1] ?? null,
        nextMatchKey: null,
        nextSlot: null,
        bracketSide: "grand_final",
      }),
    ];
  }

  const wRounds = Math.log2(size);
  const planned: PlannedMatch[] = [];

  // ── Winners ──────────────────────────────────────────────────────────────
  for (let r = 0; r < wRounds; r++) {
    const count = size / Math.pow(2, r + 1);
    for (let i = 0; i < count; i++) {
      const isLast = r === wRounds - 1;
      const loserLbRound = r === 0 ? 0 : 2 * r - 1;
      planned.push(
        withByeFlag({
          key: `w:${r}:${i}`,
          roundIndex: r,
          matchIndex: i,
          athleteAId: r === 0 ? (seeds[i * 2] ?? null) : null,
          athleteBId: r === 0 ? (seeds[i * 2 + 1] ?? null) : null,
          nextMatchKey: isLast ? "gf:0:0" : `w:${r + 1}:${Math.floor(i / 2)}`,
          nextSlot: isLast ? "a" : i % 2 === 0 ? "a" : "b",
          bracketSide: "winners",
          loserNextMatchKey: `l:${loserLbRound}:${r === 0 ? Math.floor(i / 2) : i}`,
          loserNextSlot: r === 0 ? (i % 2 === 0 ? "a" : "b") : "b",
        }),
      );
    }
  }

  // ── Losers: 2*(wRounds-1) rounds (drop-in on odd indices after L0) ────────
  const lbRounds = 2 * (wRounds - 1);
  for (let lr = 0; lr < lbRounds; lr++) {
    const count = Math.max(1, size / Math.pow(2, Math.floor(lr / 2) + 2));
    for (let i = 0; i < count; i++) {
      const isLast = lr === lbRounds - 1;
      const nextMatchKey = isLast
        ? "gf:0:0"
        : lr % 2 === 0
          ? `l:${lr + 1}:${i}`
          : `l:${lr + 1}:${Math.floor(i / 2)}`;
      const nextSlot: "a" | "b" = isLast
        ? "b"
        : lr % 2 === 0
          ? "a"
          : i % 2 === 0
            ? "a"
            : "b";
      planned.push({
        key: `l:${lr}:${i}`,
        roundIndex: 100 + lr,
        matchIndex: i,
        athleteAId: null,
        athleteBId: null,
        nextMatchKey,
        nextSlot,
        bracketSide: "losers",
        isBye: false,
      });
    }
  }

  planned.push({
    key: "gf:0:0",
    roundIndex: 200,
    matchIndex: 0,
    athleteAId: null,
    athleteBId: null,
    nextMatchKey: null,
    nextSlot: null,
    bracketSide: "grand_final",
    isBye: false,
  });

  return planned;
}

/** Every next/loser pointer must resolve to an existing key (or null). */
export function assertBracketLinksResolve(planned: PlannedMatch[]): void {
  const keys = new Set(planned.map((p) => p.key));
  for (const p of planned) {
    if (p.nextMatchKey && !keys.has(p.nextMatchKey)) {
      throw new Error(`Broken next link ${p.key} → ${p.nextMatchKey}`);
    }
    if (p.loserNextMatchKey && !keys.has(p.loserNextMatchKey)) {
      throw new Error(`Broken loser link ${p.key} → ${p.loserNextMatchKey}`);
    }
  }
}

export function planBracket(format: BracketFormat, athleteIds: string[]): PlannedMatch[] {
  switch (format) {
    case "double_elim":
      return planDoubleElimination(athleteIds);
    case "round_robin":
      return planRoundRobin(athleteIds);
    case "single_elim_consolation":
      return planSingleElimConsolation(athleteIds);
    case "single_elim":
    default:
      return planSingleElimination(athleteIds);
  }
}

export function roundLabel(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Meias";
  if (fromEnd === 2) return "Quartos";
  if (fromEnd === 3) return "Oitavos";
  return `Ronda ${roundIndex + 1}`;
}

export function bracketSideLabel(side: BracketSide | null | undefined): string | null {
  if (!side) return null;
  const map: Record<BracketSide, string> = {
    winners: "Winners",
    losers: "Losers",
    consolation: "3º lugar",
    rr: "Grupo",
    grand_final: "Grande final",
  };
  return map[side];
}
