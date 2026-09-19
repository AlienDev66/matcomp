import { WIN_METHOD_LABEL, type CompetitionMatch, type WinMethod } from "@/lib/competition/types";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export function effectiveClock(match: {
  clock_seconds?: number;
  clock_running?: boolean;
  clock_updated_at?: string | null;
}) {
  const base = match.clock_seconds ?? 360;
  if (!match.clock_running || !match.clock_updated_at) return base;
  const elapsed = Math.floor((Date.now() - new Date(match.clock_updated_at).getTime()) / 1000);
  return Math.max(0, base - elapsed);
}

export function pickMatDisplayMatch(
  matches: CompetitionMatch[],
  mat: number,
): CompetitionMatch | null {
  const onMat = matches.filter((m) => (m.mat_number || 1) === mat);
  const live = onMat.find((m) => m.status === "live");
  if (live) return live;

  const finished = [...onMat.filter((m) => m.status === "finished")].sort(
    (a, b) =>
      b.round_index - a.round_index ||
      b.match_index - a.match_index ||
      b.sort_order - a.sort_order,
  );
  if (finished[0]) return finished[0];

  const queued = onMat
    .filter((m) => m.status === "queued" && (m.athlete_a_id || m.athlete_b_id))
    .sort(
      (a, b) =>
        a.round_index - b.round_index ||
        a.match_index - b.match_index ||
        a.sort_order - b.sort_order,
    );
  return queued[0] ?? null;
}

export function MatchDisplayView({
  match,
  divName,
}: {
  match: CompetitionMatch;
  divName: string;
}) {
  const seconds = effectiveClock(match);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const finished = match.status === "finished";
  const winnerA = match.winner_id === match.athlete_a_id;
  const winnerB = match.winner_id === match.athlete_b_id;
  const method =
    match.win_method && match.win_method in WIN_METHOD_LABEL
      ? WIN_METHOD_LABEL[match.win_method as WinMethod]
      : null;

  const [sidesFlash, setSidesFlash] = useState(false);
  const prevSwap = useRef(match.sides_swapped);
  useEffect(() => {
    if (prevSwap.current !== match.sides_swapped) {
      prevSwap.current = match.sides_swapped;
      setSidesFlash(true);
      const t = window.setTimeout(() => setSidesFlash(false), 1600);
      return () => window.clearTimeout(t);
    }
  }, [match.sides_swapped]);

  if (finished && match.winner_id) {
    const winner = winnerA ? match.athlete_a : winnerB ? match.athlete_b : null;
    return (
      <div className="min-h-dvh bg-[#1a1a1a] text-white flex flex-col">
        <div className="bg-amber-400 text-black text-center py-4 md:py-5 font-bold text-2xl md:text-4xl uppercase tracking-wide">
          Vencedor{method ? ` por ${method}` : ""}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tight">
            {winner?.full_name ?? "—"}
          </p>
          <p className="text-xl md:text-2xl text-white/45 uppercase">
            {winner?.academy?.name ?? winner?.affiliation ?? ""}
          </p>
        </div>
        <DisplayFooter
          mat={match.mat_number}
          matchIndex={match.match_index}
          round={match.round_index}
          divName={divName}
          time={`${mm}:${ss}`}
        />
      </div>
    );
  }

  const { top, bottom } = displaySides(match);

  return (
    <div className="min-h-dvh bg-[#1a1a1a] text-white flex flex-col relative">
      {sidesFlash && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold uppercase tracking-wider shadow-lg">
          Lados sincronizados
        </div>
      )}
      <DisplayAthleteRow
        name={top.name}
        academy={top.academy}
        score={top.score}
        adv={top.adv}
        pen={top.pen}
        yellow
      />
      <DisplayAthleteRow
        name={bottom.name}
        academy={bottom.academy}
        score={bottom.score}
        adv={bottom.adv}
        pen={bottom.pen}
      />
      <DisplayFooter
        mat={match.mat_number}
        matchIndex={match.match_index}
        round={match.round_index}
        divName={divName}
        time={`${mm}:${ss}`}
        live={match.clock_running}
      />
    </div>
  );
}

function displaySides(match: CompetitionMatch) {
  const swapped = !!match.sides_swapped;
  const a = {
    name: match.athlete_a?.full_name ?? "TBD",
    academy: match.athlete_a?.academy?.name ?? match.athlete_a?.affiliation ?? "",
    score: match.score_a,
    adv: match.advantages_a ?? 0,
    pen: match.penalties_a ?? 0,
  };
  const b = {
    name: match.athlete_b?.full_name ?? "TBD",
    academy: match.athlete_b?.academy?.name ?? match.athlete_b?.affiliation ?? "",
    score: match.score_b,
    adv: match.advantages_b ?? 0,
    pen: match.penalties_b ?? 0,
  };
  return swapped ? { top: b, bottom: a } : { top: a, bottom: b };
}

function DisplayAthleteRow({
  name,
  academy,
  score,
  adv,
  pen,
  yellow,
}: {
  name: string;
  academy: string;
  score: number;
  adv: number;
  pen: number;
  yellow?: boolean;
}) {
  return (
    <div className="flex flex-1 min-h-[40dvh] border-b border-white/10">
      <div className="flex-1 flex flex-col justify-center px-6 md:px-10 min-w-0">
        <p className="font-display text-4xl md:text-6xl lg:text-7xl font-bold uppercase tracking-tight truncate">
          {name}
        </p>
        <p className="mt-2 text-lg md:text-xl text-white/40 uppercase truncate">{academy || "—"}</p>
      </div>
      <div className="flex items-stretch shrink-0">
        <div className="flex flex-col justify-center gap-4 px-4 md:px-6 text-center border-l border-white/10 w-20 md:w-28">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/35">Advantage</p>
            <p
              className={cn(
                "text-3xl md:text-4xl font-bold tabular-nums",
                adv > 0 ? "text-emerald-400" : "text-white/40",
              )}
            >
              {adv}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-rose-400/70">Penalty</p>
            <p
              className={cn(
                "text-3xl md:text-4xl font-bold tabular-nums",
                pen > 0 ? "text-rose-400" : "text-white/40",
              )}
            >
              {pen}
            </p>
          </div>
        </div>
        <div
          className={cn(
            "flex items-center justify-center w-36 md:w-52 lg:w-64",
            yellow ? "bg-amber-400" : "bg-black",
          )}
        >
          <span
            className={cn(
              "font-display text-7xl md:text-8xl lg:text-9xl font-bold tabular-nums leading-none",
              yellow ? "text-emerald-700" : "text-white",
            )}
          >
            {score}
          </span>
        </div>
      </div>
    </div>
  );
}

function DisplayFooter({
  mat,
  matchIndex,
  round,
  divName,
  time,
  live,
}: {
  mat: number;
  matchIndex: number;
  round: number;
  divName: string;
  time: string;
  live?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-[#111] px-4 md:px-6 py-3 md:py-4 border-t border-white/10">
      <div className="flex items-center gap-4 min-w-0">
        <div className="bg-white text-black font-bold text-2xl md:text-3xl px-3 py-1 tabular-nums shrink-0">
          {mat}-{matchIndex + 1}
        </div>
        <div className="min-w-0">
          <p className="text-xs md:text-sm text-white/50 uppercase truncate">
            Display / {divName}
          </p>
          <p className="text-amber-400 font-semibold text-sm md:text-base">R{round + 1}</p>
        </div>
      </div>
      <p
        className={cn(
          "font-display text-4xl md:text-6xl tabular-nums tracking-tight shrink-0",
          live ? "text-white" : "text-amber-400",
        )}
      >
        {time}
      </p>
    </div>
  );
}
