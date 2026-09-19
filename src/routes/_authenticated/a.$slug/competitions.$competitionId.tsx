import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  addEntry,
  createDivision,
  fetchAcademyBySlug,
  fetchAthletes,
  fetchCompetition,
  fetchDivisions,
  fetchEntries,
  fetchMatches,
  generateBracket,
  setMatchWinner,
} from "@/lib/competition/api";
import { STATUS_LABEL } from "@/lib/competition/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/a/$slug/competitions/$competitionId")({
  head: () => ({ meta: [{ title: "Competição — MatComp" }] }),
  component: CompetitionAdminPage,
});

function CompetitionAdminPage() {
  const { slug, competitionId } = Route.useParams();
  const qc = useQueryClient();
  const { data: academy } = useQuery({
    queryKey: ["academy", slug],
    queryFn: () => fetchAcademyBySlug(slug),
  });
  const { data: competition } = useQuery({
    queryKey: ["competition", competitionId],
    queryFn: () => fetchCompetition(competitionId),
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ["divisions", competitionId],
    queryFn: () => fetchDivisions(competitionId),
  });
  const { data: entries = [] } = useQuery({
    queryKey: ["entries", competitionId],
    queryFn: () => fetchEntries(competitionId),
  });
  const { data: matches = [] } = useQuery({
    queryKey: ["matches", competitionId],
    queryFn: () => fetchMatches(competitionId),
  });
  const { data: athletes = [] } = useQuery({
    queryKey: ["athletes", academy?.id],
    queryFn: () => fetchAthletes(academy!.id),
    enabled: !!academy?.id,
  });

  const [divName, setDivName] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [busy, setBusy] = useState(false);

  const availableAthletes = useMemo(() => {
    const taken = new Set(entries.map((e) => e.athlete_id));
    return athletes.filter((a) => !taken.has(a.id));
  }, [athletes, entries]);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["divisions", competitionId] }),
      qc.invalidateQueries({ queryKey: ["entries", competitionId] }),
      qc.invalidateQueries({ queryKey: ["matches", competitionId] }),
      qc.invalidateQueries({ queryKey: ["competition", competitionId] }),
    ]);
  };

  const addDiv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!divName.trim()) return;
    setBusy(true);
    try {
      await createDivision(competitionId, divName);
      setDivName("");
      toast.success("Divisão criada");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const enroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!athleteId) return toast.error("Escolhe um atleta");
    setBusy(true);
    try {
      await addEntry(competitionId, athleteId, divisionId || null);
      setAthleteId("");
      toast.success("Inscrição feita");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const gen = async () => {
    const div = divisionId || divisions[0]?.id;
    if (!div) return toast.error("Cria uma divisão primeiro");
    const ids = entries.filter((e) => e.division_id === div).map((e) => e.athlete_id);
    if (ids.length < 2) return toast.error("Precisas de pelo menos 2 atletas nesta divisão");
    setBusy(true);
    try {
      await generateBracket(competitionId, div, ids);
      toast.success("Chave gerada — competição ao vivo");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const win = async (matchId: string, winnerId: string) => {
    try {
      await setMatchWinner(matchId, winnerId);
      toast.success("Vencedor registado");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!competition) {
    return <p className="text-muted-foreground">A carregar…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-primary uppercase">{STATUS_LABEL[competition.status]}</p>
          <h1 className="font-display text-3xl font-bold mt-1">{competition.name}</h1>
          {competition.venue && <p className="text-sm text-muted-foreground mt-1">{competition.venue}</p>}
        </div>
        <Button asChild variant="outline" className="border-white/15">
          <Link to="/$lang/event/$eventId" params={{ lang: "pt", eventId: competitionId }} target="_blank">
            <ExternalLink className="h-4 w-4 mr-2" /> Página pública
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold">Divisões</h2>
          <form onSubmit={addDiv} className="flex gap-2">
            <Input value={divName} onChange={(e) => setDivName(e.target.value)} placeholder="Absoluto adulto" />
            <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 shrink-0">
              +
            </Button>
          </form>
          <ul className="space-y-1 text-sm">
            {divisions.map((d) => (
              <li key={d.id} className="flex justify-between rounded-lg bg-secondary/40 px-3 py-2">
                <span>{d.name}</span>
                <span className="text-muted-foreground">
                  {entries.filter((e) => e.division_id === d.id).length} inscritos
                </span>
              </li>
            ))}
            {divisions.length === 0 && <li className="text-muted-foreground">Nenhuma divisão</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold">Inscrever atleta</h2>
          <form onSubmit={enroll} className="space-y-3">
            <div>
              <Label>Atleta</Label>
              <Select value={athleteId} onValueChange={setAthleteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleciona…" />
                </SelectTrigger>
                <SelectContent>
                  {availableAthletes.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Divisão</Label>
              <Select value={divisionId} onValueChange={setDivisionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleciona…" />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90">
              Inscrever
            </Button>
          </form>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void gen()} className="w-full">
            Gerar chave (divisão selecionada)
          </Button>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Lutas</h2>
        {matches.length === 0 && (
          <p className="text-sm text-muted-foreground">Gera a chave para ver as lutas.</p>
        )}
        <div className="space-y-2">
          {matches.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-xl border border-border bg-card/30 p-4",
                m.status === "finished" && "opacity-70",
              )}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-2">
                <span>
                  R{m.round_index + 1} · Luta {m.match_index + 1}
                </span>
                <span className="uppercase tracking-wider">{m.status}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { id: m.athlete_a_id, name: m.athlete_a?.full_name ?? "BYE / TBD" },
                  { id: m.athlete_b_id, name: m.athlete_b?.full_name ?? "BYE / TBD" },
                ].map((side) => (
                  <button
                    key={side.id ?? side.name}
                    type="button"
                    disabled={!side.id || m.status === "finished"}
                    onClick={() => side.id && void win(m.id, side.id)}
                    className={cn(
                      "rounded-lg border border-border px-3 py-3 text-left text-sm font-medium transition",
                      m.winner_id === side.id && "border-primary bg-primary/15",
                      side.id && m.status !== "finished" && "hover:border-primary/50",
                    )}
                  >
                    {side.name}
                    {side.id && m.status !== "finished" && (
                      <span className="block text-[10px] text-muted-foreground mt-1">Tocar = vencedor</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
