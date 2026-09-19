import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createAthlete, fetchAcademyBySlug, fetchAthletes } from "@/lib/competition/api";
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

export const Route = createFileRoute("/_authenticated/a/$slug/athletes")({
  head: () => ({ meta: [{ title: "Atletas — MatComp" }] }),
  component: AthletesPage,
});

function AthletesPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const { data: academy } = useQuery({
    queryKey: ["academy", slug],
    queryFn: () => fetchAcademyBySlug(slug),
  });
  const { data: athletes = [], isLoading } = useQuery({
    queryKey: ["athletes", academy?.id],
    queryFn: () => fetchAthletes(academy!.id),
    enabled: !!academy?.id,
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academy) return;
    setBusy(true);
    try {
      await createAthlete(academy.id, { full_name: name });
      toast.success("Atleta adicionado");
      setName("");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["athletes", academy.id] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Atletas</h1>
          <p className="text-sm text-muted-foreground mt-1">Roster da academia</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo atleta</DialogTitle>
            </DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div>
                <Label>Nome completo</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90">
                {busy ? "A guardar…" : "Guardar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-muted-foreground">A carregar…</p>}
      <div className="divide-y divide-border rounded-2xl border border-border bg-card/30">
        {athletes.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-5 py-3">
            <p className="font-medium">{a.full_name}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {a.belt} · {a.category}
            </p>
          </div>
        ))}
        {!isLoading && athletes.length === 0 && (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">Sem atletas ainda.</p>
        )}
      </div>
    </div>
  );
}
