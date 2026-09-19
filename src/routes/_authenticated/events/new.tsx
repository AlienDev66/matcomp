import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createEvent, fetchMyAcademies } from "@/lib/competition/api";
import { fetchFederations } from "@/lib/competition/federations";
import { fetchMyOrganizers, fetchOrganizerEvents } from "@/lib/competition/organizers";
import { AppChrome } from "@/components/AppChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/events/new")({
  head: () => ({ meta: [{ title: "Criar evento — MatComp" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    organizer: typeof s.organizer === "string" ? s.organizer : undefined,
  }),
  component: NewEventPage,
});

const STEPS = ["Organização", "Detalhes", "Modelo"] as const;

type CreateMode = "blank" | "duplicate" | "inhouse" | "adult_gi";

function NewEventPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const { data: organizers = [], isLoading: loadingOrgs } = useQuery({
    queryKey: ["my-organizers"],
    queryFn: fetchMyOrganizers,
  });
  const { data: academies = [] } = useQuery({
    queryKey: ["my-academies"],
    queryFn: fetchMyAcademies,
  });
  const { data: federations = [] } = useQuery({
    queryKey: ["federations"],
    queryFn: fetchFederations,
  });

  const [organizerId, setOrganizerId] = useState("");
  const [name, setName] = useState("");
  const [runUnderFed, setRunUnderFed] = useState(false);
  const [federationId, setFederationId] = useState("none");
  const [venue, setVenue] = useState("");
  const [mapQuery, setMapQuery] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [academyId, setAcademyId] = useState("none");
  const [matsCount, setMatsCount] = useState("2");
  const [mode, setMode] = useState<CreateMode>("blank");
  const [duplicateFrom, setDuplicateFrom] = useState<string>("");

  const { data: pastEvents = [] } = useQuery({
    queryKey: ["org-events-for-dup", organizerId],
    queryFn: () => fetchOrganizerEvents(organizerId),
    enabled: !!organizerId && step === 2,
  });

  useEffect(() => {
    if (search.organizer && organizers.some((o) => o.id === search.organizer)) {
      setOrganizerId(search.organizer);
      return;
    }
    if (!organizerId && organizers.length === 1) {
      setOrganizerId(organizers[0]!.id);
    }
  }, [search.organizer, organizers, organizerId]);

  const next = () => {
    if (step === 0) {
      if (!organizerId) return toast.error("Escolhe a organização");
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!name.trim()) return toast.error("Indica o nome do evento");
      if (!venue.trim()) return toast.error("Indica o local (venue)");
      if (!startsAt) return toast.error("Indica a data/hora de início");
      if (runUnderFed && federationId === "none") {
        return toast.error("Escolhe a federação ou desmarca «correr sob federação»");
      }
      setStep(2);
    }
  };

  const submit = async () => {
    if (mode === "duplicate" && !duplicateFrom) {
      return toast.error("Escolhe o evento a duplicar");
    }
    setBusy(true);
    try {
      const event = await createEvent({
        name,
        venue,
        map_query: mapQuery || venue,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        organizer_id: organizerId,
        academy_id: academyId === "none" ? null : academyId,
        federation_id: runUnderFed && federationId !== "none" ? federationId : null,
        mats_count: Number(matsCount) || 1,
        status: "draft",
        duplicate_from_id: mode === "duplicate" ? duplicateFrom : null,
        template:
          mode === "inhouse" || mode === "adult_gi"
            ? mode
            : mode === "blank"
              ? "blank"
              : null,
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
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
            {organizers.find((o) => o.id === organizerId)?.slug ? (
              <Link
                to="/organizer/$slug"
                params={{ slug: organizers.find((o) => o.id === organizerId)!.slug }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Organizer Manager
              </Link>
            ) : (
              <Link to="/events">
                <ArrowLeft className="h-4 w-4 mr-1" /> Eventos
              </Link>
            )}
          </Button>
          <h1 className="font-display text-3xl font-bold">Criar evento</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Fluxo Smoothcomp: organização → nome / federação / venue / datas → modelo (vazio,
            duplicar ou template).
          </p>
        </div>

        <ol className="flex gap-2">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={cn(
                "flex-1 border-t-2 pt-2 text-[10px] uppercase tracking-wider",
                i <= step ? "border-primary text-primary" : "border-white/15 text-white/35",
              )}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        {!loadingOrgs && organizers.length === 0 && (
          <div className="border border-amber-500/40 bg-amber-500/10 p-4 space-y-3 text-sm">
            <p className="text-amber-100">
              Precisas de uma organização (Organizer) antes de criar eventos — igual ao Smoothcomp.
            </p>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link to="/organizer/new">Candidatar-se a organizador</Link>
            </Button>
          </div>
        )}

        {step === 0 && organizers.length > 0 && (
          <div className="space-y-4 border border-border bg-card/40 p-5">
            <div>
              <Label>Organização *</Label>
              <Select value={organizerId || undefined} onValueChange={setOrganizerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolhe a organização…" />
                </SelectTrigger>
                <SelectContent>
                  {organizers.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} ({o.credits_balance ?? 0} créditos)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                <Link to="/organizer" className="text-primary hover:underline">
                  Gerir organizações
                </Link>
              </p>
            </div>
            <Button
              type="button"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={!organizerId}
              onClick={next}
            >
              Continuar <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 border border-border bg-card/40 p-5">
            <div>
              <Label>Nome do evento *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Open Interno 2026"
                autoFocus
              />
            </div>

            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={runUnderFed}
                onChange={(e) => setRunUnderFed(e.target.checked)}
              />
              <span>
                Este evento corre sob uma federação
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Fica pendente de aprovação e pode aparecer na página da federação.
                </span>
              </span>
            </label>

            {runUnderFed && (
              <div>
                <Label>Federação *</Label>
                <Select value={federationId} onValueChange={setFederationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolhe…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Escolhe…</SelectItem>
                    {federations.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Venue / local *</Label>
              <Input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Pavilhão Municipal, cidade"
              />
            </div>
            <div>
              <Label>Morada / mapa (opcional)</Label>
              <Input
                value={mapQuery}
                onChange={(e) => setMapQuery(e.target.value)}
                placeholder="Morada completa para o Google Maps"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Início do evento *</Label>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Não é a hora do 1.º combate — isso depende dos tatamis.
                </p>
              </div>
              <div>
                <Label>Fim (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nº de tatamis</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={matsCount}
                  onChange={(e) => setMatsCount(e.target.value)}
                />
              </div>
              <div>
                <Label>Academia host (opcional)</Label>
                <Select value={academyId} onValueChange={setAcademyId}>
                  <SelectTrigger>
                    <SelectValue />
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
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="border-white/15" onClick={() => setStep(0)}>
                Voltar
              </Button>
              <Button type="button" className="flex-1 bg-primary hover:bg-primary/90" onClick={next}>
                Continuar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 border border-border bg-card/40 p-5">
            <p className="text-sm text-white/50">Como queres criar o evento?</p>
            <div className="space-y-2">
              {(
                [
                  { id: "blank" as const, title: "Evento em branco", desc: "Configuras divisões depois" },
                  {
                    id: "duplicate" as const,
                    title: "Duplicar evento anterior",
                    desc: "Copia a estrutura de divisões",
                  },
                  {
                    id: "inhouse" as const,
                    title: "Template In-House",
                    desc: "Open + Iniciante — ideal para torneios internos",
                  },
                  {
                    id: "adult_gi" as const,
                    title: "Template Adult Gi (IBJJF-like)",
                    desc: "Male + Female Adult Gi com classes de peso",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={cn(
                    "w-full text-left border px-4 py-3 transition",
                    mode === opt.id
                      ? "border-primary bg-primary/10"
                      : "border-white/10 hover:border-white/25",
                  )}
                >
                  <p className="font-medium text-sm">{opt.title}</p>
                  <p className="text-xs text-white/40 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            {mode === "duplicate" && (
              <div>
                <Label>Evento a duplicar</Label>
                <Select value={duplicateFrom || undefined} onValueChange={setDuplicateFrom}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolhe…" />
                  </SelectTrigger>
                  <SelectContent>
                    {pastEvents.map((ev: any) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pastEvents.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ainda não há eventos nesta organização para duplicar.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="border-white/15" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button
                type="button"
                disabled={busy}
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={() => void submit()}
              >
                <Check className="mr-2 h-4 w-4" />
                {busy ? "A criar…" : "Criar evento"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppChrome>
  );
}
