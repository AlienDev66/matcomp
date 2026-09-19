import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createCompetition,
  fetchAcademyBySlug,
  fetchCompetitions,
} from "@/lib/competition/api";
import { STATUS_LABEL } from "@/lib/competition/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/a/$slug/competitions")({
  head: () => ({ meta: [{ title: "Competições — MatComp" }] }),
  component: CompetitionsPage,
});

function CompetitionsPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const { data: academy } = useQuery({
    queryKey: ["academy", slug],
    queryFn: () => fetchAcademyBySlug(slug),
  });
  const { data: competitions = [], isLoading } = useQuery({
    queryKey: ["competitions", academy?.id],
    queryFn: () => fetchCompetitions(academy!.id),
    enabled: !!academy?.id,
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academy) return;
    setBusy(true);
    try {
      const c = await createCompetition(academy.id, { name, venue });
      toast.success("Competição criada");
      setOpen(false);
      setName("");
      setVenue("");
      await qc.invalidateQueries({ queryKey: ["competitions", academy.id] });
      // stay on list — user clicks in
      void c;
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Competições</h1>
          <p className="text-sm text-muted-foreground mt-1">Eventos da academia</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" /> Nova
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova competição</DialogTitle>
            </DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Open Interno 2026" />
              </div>
              <div>
                <Label>Local (opcional)</Label>
                <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Tatâmi principal" />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90">
                {busy ? "A criar…" : "Criar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-muted-foreground">A carregar…</p>}
      {!isLoading && competitions.length === 0 && (
        <p className="text-sm text-muted-foreground">Ainda não há competições.</p>
      )}

      <div className="space-y-2">
        {competitions.map((c) => (
          <Link
            key={c.id}
            to="/events/$competitionId"
            params={{ competitionId: c.id }}
            className="flex items-center justify-between rounded-2xl border border-border bg-card/40 px-5 py-4 hover:border-primary/40"
          >
            <div>
              <p className="font-display text-lg font-semibold">{c.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.venue || "Sem local"}</p>
            </div>
            <span className="text-xs tracking-wider uppercase text-primary">{STATUS_LABEL[c.status]}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
