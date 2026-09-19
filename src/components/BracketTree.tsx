import { cn } from "@/lib/utils";
import type { CompetitionMatch } from "@/lib/competition/types";
import { bracketSideLabel, roundLabel } from "@/lib/competition/bracket";
import { Link } from "@tanstack/react-router";

type Props = {
  matches: CompetitionMatch[];
  className?: string;
};

export function BracketTree({ matches, className }: Props) {
  if (matches.length === 0) {
    return <p className="text-white/40 py-8 text-center text-sm">Sem chave gerada.</p>;
  }

  const sides = [...new Set(matches.map((m) => m.bracket_side ?? "winners"))];
  const groups =
    sides.length <= 1
      ? [{ side: matches[0]?.bracket_side, list: matches }]
      : sides.map((side) => ({
          side,
          list: matches.filter((m) => (m.bracket_side ?? "winners") === side),
        }));

  return (
    <div className={cn("space-y-8", className)}>
      {groups.map((g) => {
        const rounds = [...new Set(g.list.map((m) => m.round_index))].sort((a, b) => a - b);
        const totalRounds = rounds.length;
        const sideLabel = bracketSideLabel(g.side as never);
        return (
          <div key={String(g.side)} className="space-y-3">
            {sideLabel && (
              <p className="text-xs uppercase tracking-[0.2em] text-primary">{sideLabel}</p>
            )}
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-6 min-w-max px-1">
                {rounds.map((r) => {
                  const roundMatches = g.list
                    .filter((m) => m.round_index === r)
                    .sort((a, b) => a.match_index - b.match_index);
                  return (
                    <div key={r} className="flex w-56 flex-col gap-4">
                      <p className="text-center text-[10px] uppercase tracking-[0.2em] text-white/40">
                        {roundLabel(r % 100, Math.max(totalRounds, 1))}
                      </p>
                      <div className="flex flex-1 flex-col justify-around gap-4">
                        {roundMatches.map((m) => (
                          <BracketMatchCard key={m.id} match={m} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BracketMatchCard({ match: m }: { match: CompetitionMatch }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-[#141416] overflow-hidden text-sm",
        m.status === "live" && "border-sky-500/50 ring-1 ring-sky-500/30",
        m.is_bye && "border-dashed border-amber-500/40",
      )}
    >
      {m.is_bye && (
        <p className="bg-amber-400/15 text-amber-200 text-[10px] uppercase tracking-wider px-2 py-1 text-center">
          BYE
        </p>
      )}
      <Side
        name={m.athlete_a?.full_name ?? (m.athlete_a_id ? "…" : "BYE")}
        score={m.score_a}
        winner={m.winner_id != null && m.winner_id === m.athlete_a_id}
        loser={m.winner_id != null && m.athlete_a_id != null && m.winner_id !== m.athlete_a_id}
      />
      <div className="border-t border-white/5" />
      <Side
        name={m.athlete_b?.full_name ?? (m.athlete_b_id ? "…" : "BYE")}
        score={m.score_b}
        winner={m.winner_id != null && m.winner_id === m.athlete_b_id}
        loser={m.winner_id != null && m.athlete_b_id != null && m.winner_id !== m.athlete_b_id}
      />
      <div className="flex items-center justify-between border-t border-white/5 px-2 py-1 text-[10px] text-white/35">
        <span>Mat {m.mat_number}</span>
        <Link
          to="/scoreboard/$matchId"
          params={{ matchId: m.id }}
          className="text-sky-400 hover:underline"
        >
          Scoreboard
        </Link>
      </div>
    </div>
  );
}

function Side({
  name,
  score,
  winner,
  loser,
}: {
  name: string;
  score: number;
  winner: boolean;
  loser: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2",
        winner && "bg-emerald-500/15 text-emerald-100",
        loser && "opacity-50",
      )}
    >
      <span className="truncate font-medium">{name}</span>
      <span className="tabular-nums text-white/50">{score}</span>
    </div>
  );
}
