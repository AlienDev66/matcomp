import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMatch,
  updateMatch,
  setMatchWinner,
  fetchDivisions,
  fetchMatches,
  claimMatchOnMat,
  mesaUpdateMatch,
  mesaSetWinner,
} from "@/lib/competition/api";
import { WIN_METHOD_BTN, WIN_METHOD_LABEL, type WinMethod } from "@/lib/competition/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getMesaToken, mesaTokenFromSearch, setMesaToken } from "@/lib/mesa-token";

export const Route = createFileRoute("/scoreboard/$matchId")({
  head: () => ({ meta: [{ title: "Mesa — MatComp" }] }),
  component: MesaScoreboardPage,
});

const WIN_PRIMARY: WinMethod[] = ["points", "submission"];
const WIN_SECONDARY: WinMethod[] = ["disqualification", "walkover", "no_show", "decision"];

function MesaScoreboardPage() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    const fromUrl = mesaTokenFromSearch(window.location.search);
    if (fromUrl) setMesaToken(fromUrl);
  }, []);

  const { data: match } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => fetchMatch(matchId),
    refetchInterval: 1500,
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ["divisions", match?.competition_id],
    queryFn: () => fetchDivisions(match!.competition_id),
    enabled: !!match?.competition_id,
  });
  const { data: allMatches = [] } = useQuery({
    queryKey: ["mesa-matches", match?.competition_id],
    queryFn: () => fetchMatches(match!.competition_id),
    enabled: !!match?.competition_id,
    refetchInterval: 3000,
  });

  const [seconds, setSeconds] = useState(6 * 60);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"score" | "won">("score");
  const [swapped, setSwapped] = useState(false);
  const tick = useRef<number | null>(null);
  const synced = useRef(false);

  const persistMatch = async (patch: Record<string, unknown>) => {
    const token = getMesaToken();
    if (token) {
      await mesaUpdateMatch(matchId, token, patch);
    } else {
      await updateMatch(matchId, patch as never);
    }
  };

  // Reset sync when navigating to another match; claim this fight on the tatâmi
  // so the TV display follows here after "Próxima luta".
  useEffect(() => {
    synced.current = false;
    setMode("score");
    void claimMatchOnMat(matchId)
      .then(async (m) => {
        try {
          const { queueAndSendEmail } = await import("@/lib/email.server");
          const { supabase } = await import("@/integrations/supabase/client");
          for (const ath of [m?.athlete_a, m?.athlete_b]) {
            if (!ath?.user_id) continue;
            const { data: profile } = await supabase
              .from("profiles")
              .select("email")
              .eq("user_id", ath.user_id)
              .maybeSingle();
            if (!profile?.email) continue;
            await queueAndSendEmail({
              data: {
                type: "queue_call",
                toEmail: profile.email,
                competitionId: m.competition_id,
                payload: {
                  athleteName: ath.full_name,
                  mat: m.mat_number,
                },
              },
            });
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* ignore — display still works from scores / token mesa */
      });
  }, [matchId]);

  useEffect(() => {
    if (!match || synced.current) return;
    setSeconds(match.clock_seconds ?? 360);
    setRunning(!!match.clock_running);
    setSwapped(!!match.sides_swapped);
    if (match.status === "finished") setMode("won");
    synced.current = true;
  }, [match]);

  // Keep sides in sync if another mesa tab updates them
  useEffect(() => {
    if (!match || !synced.current) return;
    setSwapped(!!match.sides_swapped);
  }, [match?.sides_swapped]);

  useEffect(() => {
    if (!running) {
      if (tick.current) window.clearInterval(tick.current);
      return;
    }
    tick.current = window.setInterval(() => {
      setSeconds((s) => {
        const next = Math.max(0, s - 1);
        if (next % 5 === 0 || next === 0) {
          void persistMatch({ clock_seconds: next, clock_running: next > 0 });
        }
        return next;
      });
    }, 1000);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
  }, [running, matchId]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const bump = async (
    side: "a" | "b",
    field: "score" | "adv" | "pen",
    delta: number,
  ) => {
    if (!match) return;
    const map = {
      score: { a: "score_a", b: "score_b" },
      adv: { a: "advantages_a", b: "advantages_b" },
      pen: { a: "penalties_a", b: "penalties_b" },
    } as const;
    const key = map[field][side];
    const current =
      field === "score"
        ? side === "a"
          ? match.score_a
          : match.score_b
        : field === "adv"
          ? side === "a"
            ? (match.advantages_a ?? 0)
            : (match.advantages_b ?? 0)
          : side === "a"
            ? (match.penalties_a ?? 0)
            : (match.penalties_b ?? 0);
    try {
      await persistMatch({
        [key]: Math.max(0, current + delta),
        status: "live",
      });
      await qc.invalidateQueries({ queryKey: ["match", matchId] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const adjustClock = async (delta: number) => {
    const next = Math.max(0, seconds + delta);
    setSeconds(next);
    try {
      await persistMatch({ clock_seconds: next });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleClock = async () => {
    const next = !running;
    setRunning(next);
    try {
      await persistMatch({
        clock_seconds: seconds,
        clock_running: next,
        status: "live",
      });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const declareWin = async (winnerId: string, method: WinMethod) => {
    try {
      const token = getMesaToken();
      if (token) {
        await mesaSetWinner(matchId, token, winnerId, method);
      } else {
        await setMatchWinner(matchId, winnerId, method);
      }
      setRunning(false);
      setMode("won");
      toast.success("Luta terminada");
      await qc.invalidateQueries({ queryKey: ["match", matchId] });
      await qc.invalidateQueries({ queryKey: ["mesa-matches", match?.competition_id] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const nextMatch = useMemo(() => {
    if (!match) return null;
    const mat = match.mat_number || 1;
    const queued = allMatches
      .filter(
        (m) =>
          m.id !== match.id &&
          (m.mat_number || 1) === mat &&
          m.status === "queued" &&
          (m.athlete_a_id || m.athlete_b_id),
      )
      .sort(
        (a, b) =>
          a.round_index - b.round_index ||
          a.match_index - b.match_index ||
          a.sort_order - b.sort_order,
      );
    return queued[0] ?? null;
  }, [allMatches, match]);

  const skipToQueue = () => {
    if (!match?.competition_id) return;
    const mat = String(match.mat_number || 1);
    void navigate({
      to: "/mesa/$competitionId/$mat",
      params: { competitionId: match.competition_id, mat },
    });
  };

  const goNext = () => {
    if (!nextMatch) {
      toast.message("Sem próxima luta neste tatâmi");
      skipToQueue();
      return;
    }
    void (async () => {
      try {
        await claimMatchOnMat(nextMatch.id);
        await qc.invalidateQueries({ queryKey: ["mesa-matches", match?.competition_id] });
      } catch {
        /* navigate anyway */
      }
      void navigate({ to: "/scoreboard/$matchId", params: { matchId: nextMatch.id } });
    })();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "spacebar") {
        e.preventDefault();
        void toggleClock();
        return;
      }
      if (k === "s") {
        e.preventDefault();
        const next = !swapped;
        setSwapped(next);
        void persistMatch({ sides_swapped: next });
        return;
      }
      if (k === "n") {
        e.preventDefault();
        goNext();
        return;
      }
      if (mode !== "score" || !match) return;
      const topSide = swapped ? "b" : "a";
      const botSide = swapped ? "a" : "b";
      if (k === "1") void bump(topSide, "score", 1);
      if (k === "2") void bump(topSide, "score", 2);
      if (k === "3") void bump(topSide, "score", 3);
      if (k === "q") void bump(botSide, "score", 1);
      if (k === "w") void bump(botSide, "score", 2);
      if (k === "e") void bump(botSide, "score", 3);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!match) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#1a1a1a] text-white/40">A carregar…</div>
    );
  }

  const divName = divisions.find((d) => d.id === match.division_id)?.name ?? "Jiu-Jitsu";
  const top = swapped
    ? {
        side: "b" as const,
        name: match.athlete_b?.full_name ?? "TBD",
        academy: match.athlete_b?.academy?.name ?? match.athlete_b?.affiliation ?? "",
        id: match.athlete_b_id,
        score: match.score_b,
        adv: match.advantages_b ?? 0,
        pen: match.penalties_b ?? 0,
        yellow: true,
      }
    : {
        side: "a" as const,
        name: match.athlete_a?.full_name ?? "TBD",
        academy: match.athlete_a?.academy?.name ?? match.athlete_a?.affiliation ?? "",
        id: match.athlete_a_id,
        score: match.score_a,
        adv: match.advantages_a ?? 0,
        pen: match.penalties_a ?? 0,
        yellow: true,
      };
  const bottom = swapped
    ? {
        side: "a" as const,
        name: match.athlete_a?.full_name ?? "TBD",
        academy: match.athlete_a?.academy?.name ?? match.athlete_a?.affiliation ?? "",
        id: match.athlete_a_id,
        score: match.score_a,
        adv: match.advantages_a ?? 0,
        pen: match.penalties_a ?? 0,
        yellow: false,
      }
    : {
        side: "b" as const,
        name: match.athlete_b?.full_name ?? "TBD",
        academy: match.athlete_b?.academy?.name ?? match.athlete_b?.affiliation ?? "",
        id: match.athlete_b_id,
        score: match.score_b,
        adv: match.advantages_b ?? 0,
        pen: match.penalties_b ?? 0,
        yellow: false,
      };

  const finished = match.status === "finished";
  const winnerName =
    match.winner_id === match.athlete_a_id
      ? match.athlete_a?.full_name
      : match.winner_id === match.athlete_b_id
        ? match.athlete_b?.full_name
        : null;
  const methodLabel =
    match.win_method && match.win_method in WIN_METHOD_LABEL
      ? WIN_METHOD_LABEL[match.win_method]
      : null;

  return (
    <div className="min-h-dvh bg-[#1c1c1c] text-white flex flex-col select-none">
      {finished && (
        <div className="border-b border-amber-400/40 bg-amber-400 text-black px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
              Vencedor{methodLabel ? ` · ${methodLabel}` : ""}
            </p>
            <p className="font-display text-xl md:text-2xl font-bold uppercase truncate">
              {winnerName ?? "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={skipToQueue}
              className="border-2 border-black/30 bg-black/10 px-5 py-2.5 text-sm font-bold uppercase tracking-wide hover:bg-black/20"
            >
              Saltar
            </button>
            <button
              type="button"
              onClick={goNext}
              className="bg-black text-amber-300 px-5 py-2.5 text-sm font-bold uppercase tracking-wide hover:bg-black/85"
            >
              {nextMatch ? "Próxima luta" : "Voltar às filas"}
            </button>
          </div>
        </div>
      )}

      {/* Athlete rows */}
      <AthleteMesaRow
        athlete={top}
        mode={mode}
        finished={finished}
        winnerId={match.winner_id}
        onBump={(f, d) => void bump(top.side, f, d)}
        onWin={(m) => top.id && void declareWin(top.id, m)}
      />
      <AthleteMesaRow
        athlete={bottom}
        mode={mode}
        finished={finished}
        winnerId={match.winner_id}
        onBump={(f, d) => void bump(bottom.side, f, d)}
        onWin={(m) => bottom.id && void declareWin(bottom.id, m)}
      />

      {/* Footer */}
      <div className="mt-auto grid gap-3 border-t border-white/10 bg-[#141414] p-3 md:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="bg-white text-black font-bold text-2xl px-3 py-1.5 tabular-nums">
              {match.mat_number}-{match.match_index + 1}
            </div>
            <div>
              <p className="text-xs text-white/45 uppercase tracking-wide truncate max-w-[280px]">
                Mesa / {divName}
              </p>
              <p className="text-amber-400 font-semibold text-sm">
                R{match.round_index + 1}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <FooterBtn
              onClick={() => setMode((m) => (m === "score" ? "won" : "score"))}
              active={mode === "won"}
            >
              {mode === "won" ? "Voltar a pontuar" : "Declarar vencedor"}
            </FooterBtn>
            <FooterBtn
              onClick={() => {
                const next = !swapped;
                setSwapped(next);
                void persistMatch({ sides_swapped: next })
                  .then(() => qc.invalidateQueries({ queryKey: ["match", matchId] }))
                  .catch((err: any) => toast.error(err.message));
              }}
            >
              Trocar lados
            </FooterBtn>
            <span className="text-[10px] text-white/30 self-center hidden md:inline">
              Teclas: 1/2/3 · Q/W/E · Space · S · N
            </span>
            {match.competition_id && (
              <>
                <Link
                  to="/mesa/$competitionId/$mat"
                  params={{
                    competitionId: match.competition_id,
                    mat: String(match.mat_number || 1),
                  }}
                  className="border border-white/20 px-3 py-1.5 text-white/70 hover:bg-white/10"
                >
                  Fila deste tatâmi
                </Link>
                <Link
                  to="/display/mat/$competitionId/$mat"
                  params={{
                    competitionId: match.competition_id,
                    mat: String(match.mat_number || 1),
                  }}
                  target="_blank"
                  className="border border-white/20 px-3 py-1.5 text-white/70 hover:bg-white/10"
                >
                  Display
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div
            className={cn(
              "font-display text-5xl md:text-6xl tabular-nums tracking-tight",
              running ? "text-white" : "text-amber-400",
            )}
          >
            {mm}:{ss}
          </div>
          <div className="flex items-center gap-1">
            <ClockBtn onClick={() => void adjustClock(-30)}>−30</ClockBtn>
            <ClockBtn onClick={() => void adjustClock(-1)}>−1</ClockBtn>
            <button
              type="button"
              onClick={() => void toggleClock()}
              className="h-10 min-w-14 bg-white/10 px-4 text-lg hover:bg-white/20"
            >
              {running ? "❚❚" : "▶"}
            </button>
            <ClockBtn onClick={() => void adjustClock(1)}>+1</ClockBtn>
            <ClockBtn onClick={() => void adjustClock(30)}>+30</ClockBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function AthleteMesaRow({
  athlete,
  mode,
  finished,
  winnerId,
  onBump,
  onWin,
}: {
  athlete: {
    name: string;
    academy: string;
    score: number;
    adv: number;
    pen: number;
    yellow: boolean;
    id: string | null;
  };
  mode: "score" | "won";
  finished: boolean;
  winnerId?: string | null;
  onBump: (field: "score" | "adv" | "pen", delta: number) => void;
  onWin: (method: WinMethod) => void;
}) {
  const isWinner = finished && !!athlete.id && athlete.id === winnerId;
  return (
    <div className="flex flex-1 min-h-[38dvh] border-b border-white/10">
      <div className="flex-1 flex flex-col justify-center gap-3 p-4 md:p-5 min-w-0">
        <div>
          <p className="font-display text-2xl md:text-4xl font-bold uppercase tracking-tight truncate">
            {athlete.name}
          </p>
          <p className="text-sm text-white/40 uppercase truncate">{athlete.academy || "—"}</p>
        </div>

        {mode === "score" && !finished ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4].map((n) => (
                <ScoreBtn key={`+${n}`} onClick={() => onBump("score", n)}>
                  +{n}
                </ScoreBtn>
              ))}
              <ScoreBtn onClick={() => onBump("adv", 1)}>+A</ScoreBtn>
              <ScoreBtn onClick={() => onBump("pen", 1)}>+P</ScoreBtn>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4].map((n) => (
                <ScoreBtn key={`-${n}`} dim onClick={() => onBump("score", -n)}>
                  −{n}
                </ScoreBtn>
              ))}
              <ScoreBtn dim onClick={() => onBump("adv", -1)}>
                −A
              </ScoreBtn>
              <ScoreBtn dim onClick={() => onBump("pen", -1)}>
                −P
              </ScoreBtn>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-amber-400">Venceu por</p>
            <div className="flex flex-wrap gap-1.5">
              {WIN_PRIMARY.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={!athlete.id || finished}
                  onClick={() => onWin(m)}
                  className="bg-amber-400 text-black font-bold text-xs md:text-sm px-4 py-2.5 disabled:opacity-40"
                >
                  {WIN_METHOD_BTN[m]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WIN_SECONDARY.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={!athlete.id || finished}
                  onClick={() => onWin(m)}
                  className="border border-white/25 text-white/80 text-[10px] md:text-xs px-3 py-2 disabled:opacity-40"
                >
                  {WIN_METHOD_BTN[m]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-stretch shrink-0">
        <div className="flex flex-col justify-center gap-3 px-3 text-center border-l border-white/10 w-16 md:w-20">
          <div>
            <p className="text-[9px] uppercase text-white/35">Adv</p>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums",
                athlete.adv > 0 ? "text-emerald-400" : "text-white/50",
              )}
            >
              {athlete.adv}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase text-rose-400/80">Pen</p>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums",
                athlete.pen > 0 ? "text-rose-400" : "text-white/50",
              )}
            >
              {athlete.pen}
            </p>
          </div>
        </div>
        <div
          className={cn(
            "flex items-center justify-center w-28 md:w-40",
            athlete.yellow ? "bg-amber-400" : "bg-black",
            isWinner && "ring-4 ring-inset ring-emerald-400",
          )}
        >
          <span
            className={cn(
              "font-display text-6xl md:text-7xl font-bold tabular-nums",
              athlete.yellow ? "text-emerald-700" : "text-white",
            )}
          >
            {athlete.score}
          </span>
        </div>
      </div>
    </div>
  );
}

function ScoreBtn({
  children,
  onClick,
  dim,
}: {
  children: React.ReactNode;
  onClick: () => void;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 min-w-10 px-2.5 text-sm font-bold",
        dim ? "bg-white/5 text-white/60 hover:bg-white/10" : "bg-white/15 hover:bg-white/25",
      )}
    >
      {children}
    </button>
  );
}

function ClockBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 min-w-10 bg-white/10 px-2 text-xs font-semibold hover:bg-white/20"
    >
      {children}
    </button>
  );
}

function FooterBtn({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border px-3 py-1.5",
        active ? "border-amber-400 text-amber-300" : "border-white/20 text-white/70 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}
