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
 * Double-elimination MVP (power-of-2):
 * winners bracket + losers bracket + single grand final.
 */
export function planDoubleElimination(athleteIds: string[]): PlannedMatch[] {
  if (athleteIds.length < 2) {
    throw new Error("São precisos pelo menos 2 atletas para gerar a chave.");
  }

  const seeds = seedAthletes(athleteIds);
  const size = seeds.length;
  const wRounds = Math.log2(size);
  const planned: PlannedMatch[] = [];

  // ── Winners ──────────────────────────────────────────────────────────────
  const w0 = size / 2;
  for (let i = 0; i < w0; i++) {
    const a = seeds[i * 2] ?? null;
    const b = seeds[i * 2 + 1] ?? null;
    planned.push(
      withByeFlag({
        key: `w:0:${i}`,
        roundIndex: 0,
        matchIndex: i,
        athleteAId: a,
        athleteBId: b,
        nextMatchKey: wRounds > 1 ? `w:1:${Math.floor(i / 2)}` : `gf:0:0`,
        nextSlot: wRounds > 1 ? (i % 2 === 0 ? "a" : "b") : "a",
        bracketSide: "winners",
        // Losers of W0 go to L0
        loserNextMatchKey: `l:0:${Math.floor(i / 2)}`,
        loserNextSlot: i % 2 === 0 ? "a" : "b",
      }),
    );
  }

  let wCount = w0 / 2;
  for (let r = 1; r < wRounds; r++) {
    for (let i = 0; i < wCount; i++) {
      const isLast = r === wRounds - 1;
      planned.push({
        key: `w:${r}:${i}`,
        roundIndex: r,
        matchIndex: i,
        athleteAId: null,
        athleteBId: null,
        nextMatchKey: isLast ? `gf:0:0` : `w:${r + 1}:${Math.floor(i / 2)}`,
        nextSlot: isLast ? "a" : i % 2 === 0 ? "a" : "b",
        bracketSide: "winners",
        isBye: false,
        // Drop losers into losers bracket at round r*2-1 style slot
        loserNextMatchKey: isLast ? `l:${wRounds}:${0}` : `l:${r * 2 - 1}:${i}`,
        loserNextSlot: isLast ? "b" : "b",
      });
    }
    wCount /= 2;
  }

  // ── Losers (simplified: L0 pairs W0 losers; then cascade) ───────────────
  // L0: size/4 matches
  const l0 = Math.max(1, size / 4);
  for (let i = 0; i < l0; i++) {
    const hasNext = wRounds > 1;
    planned.push({
      key: `l:0:${i}`,
      roundIndex: 100,
      matchIndex: i,
      athleteAId: null,
      athleteBId: null,
      nextMatchKey: hasNext ? `l:1:${i}` : `gf:0:0`,
      nextSlot: hasNext ? "a" : "b",
      bracketSide: "losers",
      isBye: false,
    });
  }

  // Intermediate losers rounds: receive W losers + previous L winners
  for (let r = 1; r < wRounds; r++) {
    const count = Math.max(1, size / Math.pow(2, r + 2));
    for (let i = 0; i < count; i++) {
      const isLastL = r === wRounds - 1;
      planned.push({
        key: `l:${r}:${i}`,
        roundIndex: 100 + r,
        matchIndex: i,
        athleteAId: null,
        athleteBId: null,
        nextMatchKey: isLastL ? `gf:0:0` : `l:${r + 1}:${Math.floor(i / 2)}`,
        nextSlot: isLastL ? "b" : i % 2 === 0 ? "a" : "b",
        bracketSide: "losers",
        isBye: false,
      });
    }
  }

  // Ensure final losers feed key exists for WB final loser
  const lastLKey = `l:${wRounds}:0`;
  if (!planned.some((p) => p.key === lastLKey)) {
    planned.push({
      key: lastLKey,
      roundIndex: 100 + wRounds,
      matchIndex: 0,
      athleteAId: null,
      athleteBId: null,
      nextMatchKey: `gf:0:0`,
      nextSlot: "b",
      bracketSide: "losers",
      isBye: false,
    });
  }

  // Wire WB final loser → lastLKey slot b already set above on last W match

  // ── Grand final ──────────────────────────────────────────────────────────
  planned.push({
    key: `gf:0:0`,
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
