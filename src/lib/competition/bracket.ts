/** Single-elimination bracket helpers (pure, testable). */

export type BracketSeed = string | null; // profile id or bye

export type PlannedMatch = {
  roundIndex: number;
  matchIndex: number;
  athleteAId: string | null;
  athleteBId: string | null;
  /** Index into the same planned list for the next round match; -1 = final */
  nextMatchKey: string | null; // `${round}:${match}`
  nextSlot: "a" | "b" | null;
  key: string;
};

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Pair first vs last for a balanced first round. */
export function seedAthletes(ids: string[]): BracketSeed[] {
  const size = nextPowerOfTwo(Math.max(ids.length, 2));
  const seeds: BracketSeed[] = [...ids];
  while (seeds.length < size) seeds.push(null);
  return seeds;
}

/**
 * Build a full single-elim bracket plan.
 * Round 0 = first round, last round = final.
 */
export function planSingleElimination(athleteIds: string[]): PlannedMatch[] {
  if (athleteIds.length < 2) {
    throw new Error("São precisos pelo menos 2 atletas para gerar a chave.");
  }

  const seeds = seedAthletes(athleteIds);
  const size = seeds.length;
  const totalRounds = Math.log2(size);
  const planned: PlannedMatch[] = [];

  // First round pairings: 0 vs 1, 2 vs 3, ...
  const round0Count = size / 2;
  for (let i = 0; i < round0Count; i++) {
    const a = seeds[i * 2] ?? null;
    const b = seeds[i * 2 + 1] ?? null;
    planned.push({
      key: `0:${i}`,
      roundIndex: 0,
      matchIndex: i,
      athleteAId: a,
      athleteBId: b,
      nextMatchKey: totalRounds > 1 ? `1:${Math.floor(i / 2)}` : null,
      nextSlot: totalRounds > 1 ? (i % 2 === 0 ? "a" : "b") : null,
    });
  }

  // Later rounds (empty slots, filled as winners advance)
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
      });
    }
    matchesInRound /= 2;
  }

  return planned;
}

export function roundLabel(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Meias";
  if (fromEnd === 2) return "Quartos";
  if (fromEnd === 3) return "Oitavos";
  return `Ronda ${roundIndex + 1}`;
}
