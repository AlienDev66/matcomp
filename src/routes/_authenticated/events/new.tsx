import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createEvent, fetchMyAcademies } from "@/lib/competition/api";
import { fetchFederations } from "@/lib/competition/federations";
import { AppChrome } from "@/components/AppChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/events/new")({
  head: () => ({ meta: [{ title: "Criar evento — MatComp" }] }),
  component: NewEventPage,
});

function NewEventPage() {
  const navigate = useNavigate();
  const { data: academies = [] } = useQuery({
    queryKey: ["my-academies"],
    queryFn: fetchMyAcademies,
  });
  const { data: federations = [] } = useQuery({
    queryKey: ["federations"],
    queryFn: fetchFederations,
  });

  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [academyId, setAcademyId] = useState<string>("none");
  const [federationId, setFederationId] = useState<string>("none");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Indica o nome do evento");
    setBusy(true);
    try {
      const event = await createEvent({
        name,
        venue,
        academy_id: academyId === "none" ? null : academyId,
        federation_id: federationId === "none" ? null : federationId,
        status: "draft",
      });
      toast.success("Evento criado");
      void navigate({ to: "/events/$competitionId", params: { competitionId: event.id } });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar evento");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppChrome title="Novo evento">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
            <Link to="/events">
              <ArrowLeft className="h-4 w-4 mr-1" /> Eventos
            </Link>
          </Button>
          <h1 className="font-display text-3xl font-bold">Criar evento</h1>
          <p className="text-sm text-muted-foreground">
            Qualquer conta pode criar uma competição. Associa uma academia host se quiseres.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card/40 p-5">
          <div>
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Open Interno 2026"
              autoFocus
            />
          </div>
          <div>
            <Label>Local (opcional)</Label>
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Tatâmi principal" />
          </div>
          <div>
            <Label>Academia host (opcional)</Label>
            <Select value={academyId} onValueChange={setAcademyId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem academia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem academia</SelectItem>
                {academies.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Federação (opcional)</Label>
            <Select value={federationId} onValueChange={setFederationId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem federação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem federação</SelectItem>
                {federations.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Se associares, o evento aparece em /f/{`{slug}`} e no subdomínio.
            </p>
          </div>
          <Button type="submit" disabled={busy} className="w-full min-h-12 bg-primary hover:bg-primary/90">
            {busy ? "A criar…" : "Criar evento"}
          </Button>
        </form>
      </div>
    </AppChrome>
  );
}
