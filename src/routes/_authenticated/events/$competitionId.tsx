import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { uploadEventCover } from "@/lib/event-cover";
import {
  addEntry,
  createDivision,
  createDivisionTemplate,
  createEventStaff,
  createIbjjfAdultGiTemplate,
  fetchAthletes,
  fetchCompetition,
  fetchDivisions,
  fetchEntries,
  fetchEventStaff,
  fetchMatches,
  fetchMyAcademies,
  fetchMyAthleteMemberships,
  generateBracket,
  redistributeMats,
  requestFederationApproval,
  revokeEventStaff,
  selfRegisterForCompetition,
  setEntryApproved,
  setMatchWinner,
  setMatPaused,
  recordWeighIn,
  reopenMatch,
  recalculateEtas,
  fetchEmailOutbox,
  canManageCompetition,
  updateCompetition,
  updateCompetitionStatus,
  updateDivision,
  updateMatch,
} from "@/lib/competition/api";
import { fetchFederations } from "@/lib/competition/federations";
import { DIVISION_TEMPLATE_META, type DivisionTemplatePreset } from "@/lib/competition/eligibility";
import { BRACKET_FORMAT_LABEL, type BracketFormat } from "@/lib/competition/bracket";
import { formatPrice, STATUS_LABEL, type CompetitionStatus } from "@/lib/competition/types";
import { sendEventReminders, queueAndSendEmail } from "@/lib/email.server";
import { AppChrome } from "@/components/AppChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/events/$competitionId")({
  head: () => ({ meta: [{ title: "Evento — MatComp" }] }),
  component: EventAdminPage,
});

function EventAdminPage() {
  const { competitionId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

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
  const { data: hostAthletes = [] } = useQuery({
    queryKey: ["athletes", competition?.academy_id],
    queryFn: () => fetchAthletes(competition!.academy_id!),
    enabled: !!competition?.academy_id,
  });
  const { data: myAthletes = [] } = useQuery({
    queryKey: ["my-athlete-memberships"],
    queryFn: fetchMyAthleteMemberships,
  });
  const { data: staffAcademies = [] } = useQuery({
    queryKey: ["my-academies"],
    queryFn: fetchMyAcademies,
  });
  const { data: federations = [] } = useQuery({
    queryKey: ["federations"],
    queryFn: fetchFederations,
  });
  const { data: canManageRpc } = useQuery({
    queryKey: ["can-manage-comp", competitionId, user?.id],
    queryFn: () => canManageCompetition(competitionId),
    enabled: !!user && !!competitionId,
  });

  const isManager =
    !!canManageRpc ||
    (!!user &&
      !!competition &&
      (competition.created_by === user.id ||
        (!!competition.academy_id &&
          staffAcademies.some((a) => a.id === competition.academy_id))));

  const { data: eventStaff = [] } = useQuery({
    queryKey: ["event-staff", competitionId],
    queryFn: () => fetchEventStaff(competitionId),
    enabled: !!isManager,
  });
  const { data: emailOutbox = [] } = useQuery({
    queryKey: ["email-outbox", competitionId],
    queryFn: () => fetchEmailOutbox(competitionId),
    enabled: !!isManager,
  });

  const canSelfRegister =
    competition?.status === "registration" &&
    myAthletes.length > 0 &&
    !entries.some((e) => myAthletes.some((a) => a.id === e.athlete_id));

  const [divName, setDivName] = useState("");
  const [divPrice, setDivPrice] = useState("0");
  const [athleteId, setAthleteId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [matAssign, setMatAssign] = useState("1");
  const [bracketFormat, setBracketFormat] = useState<BracketFormat>("single_elim");
  const [selfDivId, setSelfDivId] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"operacao" | "inscritos" | "categorias" | "pagina">("operacao");
  const [settings, setSettings] = useState({
    cover_image_url: "",
    contact_email: "",
    livestream_url: "",
    refund_policy_url: "",
    map_query: "",
    venue: "",
    starts_at: "",
    info_pt: "",
    info_en: "",
    info_es: "",
    deadline_early_at: "",
    deadline_refund_100_at: "",
    deadline_edit_at: "",
    organizer_years: "",
    organizer_events_count: "",
  });

  useEffect(() => {
    if (!competition) return;
    setSettings({
      cover_image_url: competition.cover_image_url ?? "",
      contact_email: competition.contact_email ?? "",
      livestream_url: competition.livestream_url ?? "",
      refund_policy_url: competition.refund_policy_url ?? "",
      map_query: competition.map_query ?? competition.venue ?? "",
      venue: competition.venue ?? "",
      starts_at: competition.starts_at ? competition.starts_at.slice(0, 16) : "",
      info_pt: competition.info_pt ?? competition.notes ?? "",
      info_en: competition.info_en ?? "",
      info_es: competition.info_es ?? "",
      deadline_early_at: competition.deadline_early_at
        ? competition.deadline_early_at.slice(0, 16)
        : "",
      deadline_refund_100_at: competition.deadline_refund_100_at
        ? competition.deadline_refund_100_at.slice(0, 16)
        : "",
      deadline_edit_at: competition.deadline_edit_at
        ? competition.deadline_edit_at.slice(0, 16)
        : "",
      organizer_years: competition.organizer_years?.toString() ?? "",
      organizer_events_count: competition.organizer_events_count?.toString() ?? "",
    });
  }, [competition]);

  const availableAthletes = useMemo(() => {
    // Hide only if already in the selected division (multi-entry allowed across divisions)
    return hostAthletes.filter((a) => {
      if (!divisionId) {
        return !entries.some((e) => e.athlete_id === a.id);
      }
      return !entries.some((e) => e.athlete_id === a.id && e.division_id === divisionId);
    });
  }, [hostAthletes, entries, divisionId]);

  const entriesByCategory = useMemo(() => {
    const entryDivs = divisions.filter((d) => d.kind !== "group");
    const byDiv = new Map<string, typeof entries>();
    const unassigned: typeof entries = [];
    for (const e of entries) {
      if (!e.division_id) {
        unassigned.push(e);
        continue;
      }
      const list = byDiv.get(e.division_id) ?? [];
      list.push(e);
      byDiv.set(e.division_id, list);
    }
    const groups = [
      ...entryDivs
        .map((d) => ({
          id: d.id,
          name: d.name,
          rows: byDiv.get(d.id) ?? [],
        }))
        .filter((g) => g.rows.length > 0),
      ...[...byDiv.entries()]
        .filter(([id]) => !entryDivs.some((d) => d.id === id))
        .map(([id, rows]) => ({
          id,
          name: divisions.find((d) => d.id === id)?.name ?? "Categoria",
          rows,
        })),
    ];
    if (unassigned.length) {
      groups.push({ id: "__none", name: "Sem categoria", rows: unassigned });
    }
    return groups;
  }, [entries, divisions]);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["divisions", competitionId] }),
      qc.invalidateQueries({ queryKey: ["entries", competitionId] }),
      qc.invalidateQueries({ queryKey: ["matches", competitionId] }),
      qc.invalidateQueries({ queryKey: ["competition", competitionId] }),
      qc.invalidateQueries({ queryKey: ["public-competition", competitionId] }),
    ]);
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateCompetition(competitionId, {
        cover_image_url: settings.cover_image_url.trim() || null,
        contact_email: settings.contact_email.trim() || null,
        livestream_url: settings.livestream_url.trim() || null,
        refund_policy_url: settings.refund_policy_url.trim() || null,
        map_query: settings.map_query.trim() || null,
        venue: settings.venue.trim() || null,
        starts_at: settings.starts_at ? new Date(settings.starts_at).toISOString() : null,
        info_pt: settings.info_pt.trim() || null,
        info_en: settings.info_en.trim() || null,
        info_es: settings.info_es.trim() || null,
        notes: settings.info_pt.trim() || null,
        deadline_early_at: settings.deadline_early_at
          ? new Date(settings.deadline_early_at).toISOString()
          : null,
        deadline_refund_100_at: settings.deadline_refund_100_at
          ? new Date(settings.deadline_refund_100_at).toISOString()
          : null,
        deadline_edit_at: settings.deadline_edit_at
          ? new Date(settings.deadline_edit_at).toISOString()
          : null,
        organizer_years: settings.organizer_years ? Number(settings.organizer_years) : null,
        organizer_events_count: settings.organizer_events_count
          ? Number(settings.organizer_events_count)
          : null,
      });
      toast.success("Definições guardadas");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addDiv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!divName.trim()) return;
    setBusy(true);
    try {
      const euros = Number(divPrice.replace(",", ".")) || 0;
      await createDivision(competitionId, {
        name: divName,
        price_cents: Math.round(euros * 100),
      });
      setDivName("");
      setDivPrice("0");
      toast.success("Divisão criada");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveDivPrice = async (id: string, euros: string) => {
    try {
      const value = Number(euros.replace(",", ".")) || 0;
      await updateDivision(id, { price_cents: Math.round(value * 100) });
      toast.success("Preço atualizado");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
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

  const selfRegister = async () => {
    setBusy(true);
    try {
      await selfRegisterForCompetition(competitionId, selfDivId || null);
      toast.success("Inscrição feita");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: CompetitionStatus) => {
    setBusy(true);
    try {
      await updateCompetitionStatus(competitionId, status);
      toast.success(`Estado: ${STATUS_LABEL[status]}`);
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const matsCount = Math.max(1, competition?.mats_count ?? 1);

  const gen = async () => {
    const div = divisionId || null;
    if (!div) return toast.error("Seleciona uma divisão (entry) no dropdown acima");
    const divMeta = divisions.find((d) => d.id === div);
    if (divMeta?.kind === "group") {
      return toast.error("Escolhe uma entry (peso), não um grupo");
    }
    const ids = entries
      .filter((e) => e.division_id === div && e.approved !== false)
      .map((e) => e.athlete_id);
    if (ids.length < 2) {
      return toast.error(
        `Precisas de pelo menos 2 atletas aprovados nesta divisão (tens ${ids.length}). Inscreve mais atletas na mesma entry.`,
      );
    }
    setBusy(true);
    try {
      const mat = Math.min(matsCount, Math.max(1, Number(matAssign) || 1));
      await generateBracket(competitionId, div, ids, { matNumber: mat, format: bracketFormat });
      toast.success(`Chave (${BRACKET_FORMAT_LABEL[bracketFormat]}) no tatâmi ${mat}`);
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const genReadyDivisions = async () => {
    const entryDivs = divisions.filter((d) => d.kind !== "group");
    let made = 0;
    let mat = 1;
    const maxMat = matsCount;
    setBusy(true);
    try {
      for (const d of entryDivs) {
        const ids = entries
          .filter((e) => e.division_id === d.id && e.approved !== false)
          .map((e) => e.athlete_id);
        if (ids.length < 2) continue;
        await generateBracket(competitionId, d.id, ids, {
          matNumber: mat,
          format: bracketFormat,
        });
        made += 1;
        mat = mat >= maxMat ? 1 : mat + 1;
      }
      if (made === 0) {
        toast.error("Nenhuma divisão com 2+ inscritos aprovados");
      } else {
        toast.success(`${made} chave(s) gerada(s)`);
        await refresh();
      }
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

  const toggleApproved = async (entryId: string, approved: boolean) => {
    try {
      const entry = await setEntryApproved(entryId, approved);
      toast.success(approved ? "Inscrição aprovada" : "Inscrição desaprovada");
      if (approved) {
        const ath = entry.athlete;
        // best-effort email
        void (async () => {
          try {
            const { data: profile } = ath?.user_id
              ? await (await import("@/integrations/supabase/client")).supabase
                  .from("profiles")
                  .select("email")
                  .eq("user_id", ath.user_id)
                  .maybeSingle()
              : { data: null };
            if (profile?.email) {
              await queueAndSendEmail({
                data: {
                  type: "entry_approved",
                  toEmail: profile.email,
                  competitionId,
                  payload: {
                    competitionName: competition?.name,
                    athleteName: ath?.full_name,
                  },
                },
              });
            }
          } catch {
            /* ignore */
          }
        })();
      }
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!competition) {
    return (
      <AppChrome>
        <p className="text-muted-foreground">A carregar…</p>
      </AppChrome>
    );
  }

  return (
    <AppChrome title={competition.name}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-primary uppercase">
              {STATUS_LABEL[competition.status]}
            </p>
            <h1 className="font-display text-3xl font-bold mt-1">{competition.name}</h1>
            {competition.venue && (
              <p className="text-sm text-muted-foreground mt-1">{competition.venue}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="border-white/15">
              <Link to="/$lang/event/$eventId" params={{ lang: "pt", eventId: competitionId }} target="_blank">
                <ExternalLink className="h-4 w-4 mr-1.5" /> Pública
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="border-white/15">
              <Link to="/mesa/$competitionId" params={{ competitionId }} target="_blank">
                Mesas
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="border-white/15">
              <Link to="/tv/$competitionId" params={{ competitionId }} target="_blank">
                TV
              </Link>
            </Button>
          </div>
        </div>

        {isManager && (
          <section className="flex flex-wrap gap-2">
            {(["draft", "registration", "live", "finished"] as CompetitionStatus[]).map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={competition.status === s ? "default" : "outline"}
                className={
                  competition.status === s ? "bg-primary hover:bg-primary/90" : "border-white/15"
                }
                disabled={busy}
                onClick={() => void setStatus(s)}
              >
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </section>
        )}

        {canSelfRegister && (
          <section className="border border-primary/30 bg-primary/5 p-4 space-y-3">
            <p className="font-medium">Inscrever-me neste evento</p>
            <div className="flex flex-wrap gap-2">
              {divisions.length > 0 && (
                <Select value={selfDivId} onValueChange={setSelfDivId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Categoria…" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions
                      .filter((d) => d.kind !== "group")
                      .map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} · {formatPrice(d.price_cents, d.currency)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                disabled={busy}
                className="bg-primary hover:bg-primary/90"
                onClick={() => void selfRegister()}
              >
                Confirmar
              </Button>
            </div>
          </section>
        )}

        {isManager && (
          <nav className="flex gap-1 border-b border-white/10 overflow-x-auto" aria-label="Secções">
            {(
              [
                ["operacao", "Operação"],
                ["inscritos", "Inscritos"],
                ["categorias", "Categorias"],
                ["pagina", "Página pública"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition",
                  tab === id
                    ? "border-primary text-white"
                    : "border-transparent text-white/40 hover:text-white/70",
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        )}

        {isManager && tab === "pagina" && (
            <form
              onSubmit={saveSettings}
              className="border border-border bg-card/40 p-5 space-y-4"
            >
              <h2 className="font-display text-lg font-semibold">Página pública</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <Label>Capa do evento</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      value={settings.cover_image_url}
                      onChange={(e) => setSettings((s) => ({ ...s, cover_image_url: e.target.value }))}
                      placeholder="https://… ou faz upload"
                    />
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setBusy(true);
                          try {
                            const url = await uploadEventCover(competitionId, file);
                            setSettings((s) => ({ ...s, cover_image_url: url }));
                            await updateCompetition(competitionId, { cover_image_url: url });
                            toast.success("Capa enviada");
                            await qc.invalidateQueries({ queryKey: ["competition", competitionId] });
                          } catch (err: any) {
                            toast.error(err.message ?? "Falha no upload");
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                      <Button type="button" variant="outline" className="border-white/15" asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-2" /> Upload
                        </span>
                      </Button>
                    </label>
                  </div>
                  {settings.cover_image_url && (
                    <img
                      src={settings.cover_image_url}
                      alt=""
                      className="mt-2 h-28 w-full max-w-md object-cover border border-white/10"
                    />
                  )}
                </div>
                <div>
                  <Label>Local</Label>
                  <Input
                    value={settings.venue}
                    onChange={(e) => setSettings((s) => ({ ...s, venue: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Data / hora de início</Label>
                  <Input
                    type="datetime-local"
                    value={settings.starts_at}
                    onChange={(e) => setSettings((s) => ({ ...s, starts_at: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Email de contacto</Label>
                  <Input
                    type="email"
                    value={settings.contact_email}
                    onChange={(e) => setSettings((s) => ({ ...s, contact_email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>URL livestream</Label>
                  <Input
                    value={settings.livestream_url}
                    onChange={(e) => setSettings((s) => ({ ...s, livestream_url: e.target.value }))}
                    placeholder="https://youtube.com/…"
                  />
                </div>
                <div>
                  <Label>URL política de reembolso</Label>
                  <Input
                    value={settings.refund_policy_url}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, refund_policy_url: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Mapa (pesquisa / morada)</Label>
                  <Input
                    value={settings.map_query}
                    onChange={(e) => setSettings((s) => ({ ...s, map_query: e.target.value }))}
                    placeholder="Pavilhão …, Barcelos"
                  />
                </div>
                <div>
                  <Label>Anos na plataforma</Label>
                  <Input
                    type="number"
                    value={settings.organizer_years}
                    onChange={(e) => setSettings((s) => ({ ...s, organizer_years: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Badge: nº eventos</Label>
                  <Input
                    type="number"
                    value={settings.organizer_events_count}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, organizer_events_count: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Federação (white-label)</Label>
                  <Select
                    value={competition.federation_id ?? "none"}
                    onValueChange={async (v) => {
                      try {
                        await updateCompetition(competitionId, {
                          federation_id: v === "none" ? null : v,
                        });
                        toast.success("Federação atualizada");
                        await qc.invalidateQueries({ queryKey: ["competition", competitionId] });
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {federations.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name} ({f.subdomain ?? f.slug})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prazo early bird</Label>
                  <Input
                    type="datetime-local"
                    value={settings.deadline_early_at}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, deadline_early_at: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Última chance reembolso 100%</Label>
                  <Input
                    type="datetime-local"
                    value={settings.deadline_refund_100_at}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, deadline_refund_100_at: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Última chance editar inscrição</Label>
                  <Input
                    type="datetime-local"
                    value={settings.deadline_edit_at}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, deadline_edit_at: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Info (PT)</Label>
                  <Textarea
                    rows={5}
                    value={settings.info_pt}
                    onChange={(e) => setSettings((s) => ({ ...s, info_pt: e.target.value }))}
                    placeholder="Pesagem, regras, política de reembolso…"
                  />
                </div>
                <div>
                  <Label>Info (EN)</Label>
                  <Textarea
                    rows={4}
                    value={settings.info_en}
                    onChange={(e) => setSettings((s) => ({ ...s, info_en: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Info (ES)</Label>
                  <Textarea
                    rows={4}
                    value={settings.info_es}
                    onChange={(e) => setSettings((s) => ({ ...s, info_es: e.target.value }))}
                  />
                </div>
              </div>
              <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">
                Guardar definições
              </Button>
            </form>
        )}

        {isManager && tab === "categorias" && (
              <section className="border border-border bg-card/40 p-5 space-y-4">
                <h2 className="font-display text-lg font-semibold">Categorias e preços</h2>
                <p className="text-xs text-muted-foreground">
                  Templates IBJJF-like (Adult / Master / Juvenile / Kids / No-Gi) ou categoria avulsa.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DIVISION_TEMPLATE_META) as DivisionTemplatePreset[]).flatMap(
                    (preset) =>
                      (["male", "female"] as const).map((gender) => (
                        <Button
                          key={`${preset}-${gender}`}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-white/15"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await createDivisionTemplate(competitionId, {
                                preset,
                                gender,
                                price_cents: Math.round(
                                  (Number(divPrice.replace(",", ".")) || 50) * 100,
                                ),
                              });
                              toast.success(
                                `${gender === "male" ? "Male" : "Female"} · ${DIVISION_TEMPLATE_META[preset].label}`,
                              );
                              await refresh();
                            } catch (err: any) {
                              toast.error(err.message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          + {gender === "male" ? "M" : "F"} {DIVISION_TEMPLATE_META[preset].label}
                        </Button>
                      )),
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-white/40"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await createIbjjfAdultGiTemplate(competitionId, {
                          gender: "male",
                          price_cents: Math.round((Number(divPrice.replace(",", ".")) || 50) * 100),
                        });
                        await refresh();
                      } catch (err: any) {
                        toast.error(err.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    (legado Adult Gi)
                  </Button>
                </div>
                <form onSubmit={addDiv} className="grid grid-cols-[1fr_88px_auto] gap-2">
                  <Input
                    value={divName}
                    onChange={(e) => setDivName(e.target.value)}
                    placeholder="Categoria avulsa"
                  />
                  <Input
                    value={divPrice}
                    onChange={(e) => setDivPrice(e.target.value)}
                    placeholder="50"
                    inputMode="decimal"
                  />
                  <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">
                    +
                  </Button>
                </form>
                <ul className="space-y-2 text-sm max-h-96 overflow-y-auto">
                  {divisions.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-secondary/40 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-2">
                          {d.kind === "group" ? "Grupo" : "Entry"}
                        </span>
                        {d.name}
                      </span>
                      {d.kind !== "group" && (
                        <div className="flex items-center gap-2">
                          <Input
                            className="h-8 w-20"
                            defaultValue={((d.price_cents ?? 0) / 100).toString()}
                            onBlur={(e) => void saveDivPrice(d.id, e.target.value)}
                          />
                          <span className="text-xs text-muted-foreground">EUR</span>
                          <span className="text-muted-foreground text-xs">
                            {entries.filter((e) => e.division_id === d.id).length}
                          </span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
        )}

        {isManager && tab === "inscritos" && (
              <section className="border border-border bg-card/40 p-5 space-y-4">
                <h2 className="font-display text-lg font-semibold">Inscrever atleta (staff)</h2>
                {competition.academy_id ? (
                  <form onSubmit={enroll} className="space-y-3">
                    <Select value={athleteId} onValueChange={setAthleteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Atleta…" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAthletes.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            Sem atletas disponíveis nesta divisão
                          </SelectItem>
                        ) : (
                          availableAthletes.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.full_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {availableAthletes.length} atleta(s) disponíveis nesta categoria.
                    </p>
                    <Select value={divisionId} onValueChange={setDivisionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Divisão (entry)…" />
                      </SelectTrigger>
                      <SelectContent>
                        {divisions
                          .filter((d) => d.kind !== "group")
                          .map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} (
                              {entries.filter((e) => e.division_id === d.id).length} inscritos)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90">
                      Inscrever
                    </Button>
                  </form>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sem academia host — inscrição self-serve na página pública.
                  </p>
                )}
              </section>
        )}

        {(isManager ? tab === "inscritos" : true) && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Inscritos ({entries.length})</h2>
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card/30 px-5 py-6 text-sm text-muted-foreground text-center">
              Sem inscritos
            </div>
          ) : (
            <div className="space-y-4">
              {entriesByCategory.map((group) => {
                const approved = group.rows.filter((e) => e.approved !== false).length;
                return (
                  <div
                    key={group.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-white/[0.03] px-5 py-3">
                      <h3 className="font-display font-semibold text-sm sm:text-base">
                        {group.name}
                      </h3>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {group.rows.length} inscrito{group.rows.length === 1 ? "" : "s"}
                        {" · "}
                        {approved} aprovado{approved === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="divide-y divide-border">
                      {group.rows.map((e) => (
                        <div
                          key={e.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                        >
                          <div>
                            <p className="font-medium">
                              {e.athlete?.full_name ?? e.athlete_id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {e.approved === false ? "não aprovado" : "aprovado"}
                              {e.weigh_in_status === "passed"
                                ? ` · pesagem OK (${e.weigh_in_kg ?? "?"} kg)`
                                : e.weigh_in_status === "failed"
                                  ? ` · pesagem FALHOU (${e.weigh_in_kg ?? "?"} kg)`
                                  : " · sem pesagem"}
                            </p>
                          </div>
                          {isManager && (
                            <div className="flex flex-wrap gap-1">
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="kg"
                                className="h-8 w-20"
                                id={`wi-${e.id}`}
                                defaultValue={e.weigh_in_kg ?? ""}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-white/15"
                                onClick={async () => {
                                  const el = document.getElementById(
                                    `wi-${e.id}`,
                                  ) as HTMLInputElement | null;
                                  const kg = Number(el?.value);
                                  if (!Number.isFinite(kg) || kg <= 0) {
                                    toast.error("Indica o peso em kg");
                                    return;
                                  }
                                  try {
                                    await recordWeighIn(e.id, {
                                      weigh_in_kg: kg,
                                      weigh_in_status: "passed",
                                    });
                                    toast.success("Pesagem OK");
                                    await qc.invalidateQueries({
                                      queryKey: ["entries", competitionId],
                                    });
                                  } catch (err: any) {
                                    toast.error(err.message);
                                  }
                                }}
                              >
                                OK
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-white/15 text-rose-400"
                                onClick={async () => {
                                  const el = document.getElementById(
                                    `wi-${e.id}`,
                                  ) as HTMLInputElement | null;
                                  const kg = Number(el?.value);
                                  if (!Number.isFinite(kg) || kg <= 0) {
                                    toast.error("Indica o peso em kg");
                                    return;
                                  }
                                  try {
                                    await recordWeighIn(e.id, {
                                      weigh_in_kg: kg,
                                      weigh_in_status: "failed",
                                    });
                                    toast.message("Pesagem falhada registada");
                                    await qc.invalidateQueries({
                                      queryKey: ["entries", competitionId],
                                    });
                                  } catch (err: any) {
                                    toast.error(err.message);
                                  }
                                }}
                              >
                                Falhou
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-white/15"
                                onClick={() =>
                                  void toggleApproved(e.id, e.approved === false)
                                }
                              >
                                {e.approved === false ? "Aprovar" : "Desaprovar"}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {isManager && tab === "operacao" && (
          <div className="space-y-6">
            <section className="border border-border bg-card/40 p-5 space-y-4">
              <h2 className="font-display text-lg font-semibold">Tatâmis e mesas</h2>
              <p className="text-sm text-muted-foreground">
                Cada tatâmi tem a sua mesa. Com {matsCount} tatâmi{matsCount === 1 ? "" : "s"}, abre{" "}
                {matsCount} link{matsCount === 1 ? "" : "s"} — um por computador.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Nº de tatâmis
                  </Label>
                  <Input
                    className="h-9 w-24"
                    type="number"
                    min={1}
                    max={24}
                    defaultValue={matsCount}
                    key={matsCount}
                    onBlur={async (e) => {
                      const n = Math.min(24, Math.max(1, Number(e.target.value) || 1));
                      if (n === matsCount) return;
                      setBusy(true);
                      try {
                        await updateCompetition(competitionId, { mats_count: n });
                        toast.success(`${n} tatâmi${n === 1 ? "" : "s"} configurado${n === 1 ? "" : "s"}`);
                        await qc.invalidateQueries({ queryKey: ["competition", competitionId] });
                      } catch (err: any) {
                        toast.error(err.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </div>
                <Button asChild variant="outline" className="border-white/15">
                  <Link to="/tv/$competitionId" params={{ competitionId }} target="_blank">
                    TV geral
                  </Link>
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: matsCount }, (_, i) => i + 1).map((mat) => {
                  const onMat = matches.filter((m) => (m.mat_number || 1) === mat);
                  const live = onMat.filter((m) => m.status === "live").length;
                  const queued = onMat.filter((m) => m.status === "queued").length;
                  const isPaused = (competition?.paused_mats ?? []).includes(mat);
                  return (
                    <div
                      key={mat}
                      className={cn(
                        "border bg-black/20 px-4 py-3 space-y-2",
                        isPaused ? "border-amber-500/50" : "border-white/10",
                      )}
                    >
                      <Link
                        to="/mesa/$competitionId/$mat"
                        params={{ competitionId, mat: String(mat) }}
                        search={{}}
                        target="_blank"
                        className="block hover:opacity-90"
                      >
                        <p className="text-[10px] uppercase tracking-widest text-primary">
                          Mesa {mat}
                          {isPaused ? " · PAUSADO" : ""}
                        </p>
                        <p className="font-display font-semibold">Tatâmi {mat}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {live > 0 ? `${live} ao vivo · ` : ""}
                          {queued} na fila
                        </p>
                      </Link>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-white/15 w-full"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await setMatPaused(competitionId, mat, !isPaused);
                            toast.success(isPaused ? `Tatâmi ${mat} retomado` : `Tatâmi ${mat} pausado`);
                            await qc.invalidateQueries({ queryKey: ["competition", competitionId] });
                          } catch (err: any) {
                            toast.error(err.message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {isPaused ? "Retomar" : "Pausar"}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-white/15"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await recalculateEtas(competitionId);
                    toast.success("Horários (ETA) recalculados por fila/tatâmi");
                    await refresh();
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Recalcular horários automáticos
              </Button>
            </section>

            <section className="border border-border bg-card/40 p-5 space-y-4">
              <h2 className="font-display text-lg font-semibold">Gerar chaves</h2>
              <p className="text-sm text-muted-foreground">
                Escolhe formato, categoria (≥2 aprovados) e tatâmi. BYEs são marcados e resolvidos
                automaticamente.
              </p>
              <Select
                value={bracketFormat}
                onValueChange={(v) => setBracketFormat(v as BracketFormat)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Formato…" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BRACKET_FORMAT_LABEL) as BracketFormat[]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {BRACKET_FORMAT_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={divisionId} onValueChange={setDivisionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoria (entry)…" />
                </SelectTrigger>
                <SelectContent>
                  {divisions
                    .filter((d) => d.kind !== "group")
                    .map((d) => {
                      const n = entries.filter(
                        (e) => e.division_id === d.id && e.approved !== false,
                      ).length;
                      return (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({n})
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  className="h-9 w-20"
                  type="number"
                  min={1}
                  max={matsCount}
                  value={matAssign}
                  onChange={(e) => setMatAssign(e.target.value)}
                  title="Tatâmi"
                />
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void gen()}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  Gerar chave
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void genReadyDivisions()}
                  className="flex-1 border-white/15"
                >
                  Gerar todas ({BRACKET_FORMAT_LABEL[bracketFormat]})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  className="border-white/15"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await redistributeMats(competitionId, matsCount);
                      toast.success("Tatâmis redistribuídos");
                      await refresh();
                    } catch (err: any) {
                      toast.error(err.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Redistribuir tatâmis
                </Button>
              </div>
            </section>

            <section className="border border-border bg-card/40 p-5 space-y-4">
              <h2 className="font-display text-lg font-semibold">Estações do dia</h2>
              <p className="text-sm text-muted-foreground">
                Abre em tablets/PCs dedicados: pesagem, chamada (aquecimento/tatâmi) e pódio.
                Geram tokens abaixo.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    { to: "/pesagem/$competitionId" as const, label: "Pesagem", path: "pesagem" },
                    { to: "/chamada/$competitionId" as const, label: "Chamada", path: "chamada" },
                    { to: "/podio/$competitionId" as const, label: "Pódio", path: "podio" },
                  ] as const
                ).map((s) => (
                  <Link
                    key={s.path}
                    to={s.to}
                    params={{ competitionId }}
                    search={{}}
                    target="_blank"
                    className="border border-white/10 bg-black/20 px-4 py-3 hover:border-primary/50"
                  >
                    <p className="text-[10px] uppercase tracking-widest text-primary">Estação</p>
                    <p className="font-display font-semibold">{s.label}</p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="border border-border bg-card/40 p-5 space-y-4">
              <h2 className="font-display text-lg font-semibold">Staff do evento (mesa / árbitro)</h2>
              <p className="text-sm text-muted-foreground">
                Gera links com token — a pessoa pontua sem acesso total ao admin.
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: matsCount }, (_, i) => i + 1).map((mat) => (
                  <Button
                    key={mat}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/15"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const s = await createEventStaff(competitionId, {
                          role: "mesa",
                          mat_number: mat,
                          label: `Mesa tatâmi ${mat}`,
                        });
                        const url = `${window.location.origin}/mesa/${competitionId}/${mat}?token=${s.token}`;
                        await navigator.clipboard.writeText(url);
                        toast.success(`Link mesa ${mat} copiado`);
                        await qc.invalidateQueries({ queryKey: ["event-staff", competitionId] });
                      } catch (err: any) {
                        toast.error(err.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    + Token mesa {mat}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/15"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const s = await createEventStaff(competitionId, {
                        role: "referee",
                        label: "Árbitro",
                      });
                      const url = `${window.location.origin}/mesa/${competitionId}?token=${s.token}`;
                      await navigator.clipboard.writeText(url);
                      toast.success("Link árbitro copiado");
                      await qc.invalidateQueries({ queryKey: ["event-staff", competitionId] });
                    } catch (err: any) {
                      toast.error(err.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  + Token árbitro
                </Button>
                {(
                  [
                    { role: "weigh_in" as const, label: "Pesagem", path: "pesagem" },
                    { role: "caller" as const, label: "Chamada", path: "chamada" },
                    { role: "podium" as const, label: "Pódio", path: "podio" },
                  ] as const
                ).map((st) => (
                  <Button
                    key={st.role}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/15"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const s = await createEventStaff(competitionId, {
                          role: st.role,
                          label: st.label,
                        });
                        const url = `${window.location.origin}/${st.path}/${competitionId}?token=${s.token}`;
                        await navigator.clipboard.writeText(url);
                        toast.success(`Link ${st.label} copiado`);
                        await qc.invalidateQueries({ queryKey: ["event-staff", competitionId] });
                      } catch (err: any) {
                        toast.error(err.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    + Token {st.label}
                  </Button>
                ))}
              </div>
              <ul className="space-y-2 text-sm">
                {eventStaff
                  .filter((s) => s.active)
                  .map((s) => {
                    const staffUrl =
                      s.role === "mesa" && s.mat_number
                        ? `${typeof window !== "undefined" ? window.location.origin : ""}/mesa/${competitionId}/${s.mat_number}?token=${s.token}`
                        : s.role === "weigh_in"
                          ? `${typeof window !== "undefined" ? window.location.origin : ""}/pesagem/${competitionId}?token=${s.token}`
                          : s.role === "caller"
                            ? `${typeof window !== "undefined" ? window.location.origin : ""}/chamada/${competitionId}?token=${s.token}`
                            : s.role === "podium"
                              ? `${typeof window !== "undefined" ? window.location.origin : ""}/podio/${competitionId}?token=${s.token}`
                              : `${typeof window !== "undefined" ? window.location.origin : ""}/mesa/${competitionId}?token=${s.token}`;
                    return (
                      <li
                        key={s.id}
                        className="space-y-2 border border-white/10 px-3 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {s.label ?? s.role}
                            {s.mat_number ? ` · tatâmi ${s.mat_number}` : ""}
                            {s.expires_at
                              ? ` · expira ${new Date(s.expires_at).toLocaleString("pt-PT")}`
                              : ""}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-white/15"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(staffUrl);
                                  toast.success("Link copiado");
                                } catch {
                                  toast.message("Seleciona e copia o link abaixo");
                                }
                              }}
                            >
                              Copiar link
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                await revokeEventStaff(s.id);
                                await qc.invalidateQueries({
                                  queryKey: ["event-staff", competitionId],
                                });
                              }}
                            >
                              Revogar
                            </Button>
                          </div>
                        </div>
                        <input
                          readOnly
                          value={staffUrl}
                          className="w-full bg-black/40 border border-white/10 px-2 py-1.5 text-xs text-white/70 font-mono"
                          onFocus={(e) => e.target.select()}
                        />
                      </li>
                    );
                  })}
              </ul>
            </section>

            <section className="border border-border bg-card/40 p-5 space-y-3">
              <h2 className="font-display text-lg font-semibold">Email outbox</h2>
              <p className="text-sm text-muted-foreground">
                Sem <code className="text-xs">RESEND_API_KEY</code>, os emails ficam aqui como{" "}
                <code className="text-xs">skipped_no_key</code> — úteis para debug.
              </p>
              <ul className="max-h-56 overflow-auto divide-y divide-border text-sm">
                {emailOutbox.map((row) => (
                  <li key={row.id} className="py-2 flex flex-wrap justify-between gap-2">
                    <span>
                      <span className="font-medium">{row.email_type}</span>
                      {" → "}
                      {row.to_email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {row.sent_at
                        ? `enviado ${new Date(row.sent_at).toLocaleString("pt-PT")}`
                        : row.error ?? "pendente"}
                    </span>
                  </li>
                ))}
                {emailOutbox.length === 0 && (
                  <li className="py-4 text-muted-foreground text-center">Sem emails neste evento</li>
                )}
              </ul>
            </section>

            <section className="border border-border bg-card/40 p-5 space-y-3">
              <h2 className="font-display text-lg font-semibold">Export / emails / federação</h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/15"
                  onClick={() => {
                    const rows = [
                      ["match_id", "mat", "round", "status", "a", "b", "score_a", "score_b", "winner", "method", "side"],
                      ...matches.map((m) => [
                        m.id,
                        m.mat_number,
                        m.round_index,
                        m.status,
                        m.athlete_a?.full_name ?? "",
                        m.athlete_b?.full_name ?? "",
                        m.score_a,
                        m.score_b,
                        m.winner_id ?? "",
                        m.win_method ?? "",
                        m.bracket_side ?? "",
                      ]),
                    ];
                    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `matcomp-${competitionId.slice(0, 8)}-results.csv`;
                    a.click();
                  }}
                >
                  CSV resultados
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/15"
                  onClick={() => {
                    const rows = [
                      ["entry_id", "athlete", "division", "approved", "paid"],
                      ...entries.map((e) => [
                        e.id,
                        e.athlete?.full_name ?? e.athlete_id,
                        divisions.find((d) => d.id === e.division_id)?.name ?? "",
                        e.approved !== false,
                        !!e.paid,
                      ]),
                    ];
                    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `matcomp-${competitionId.slice(0, 8)}-entries.csv`;
                    a.click();
                  }}
                >
                  CSV inscritos
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/15"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await sendEventReminders({ data: { competitionId } });
                      toast.success(`${r.sent} lembrete(s) na outbox`);
                    } catch (err: any) {
                      toast.error(err.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Enviar lembretes
                </Button>
                {competition.federation_id && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/15"
                    disabled={busy || competition.federation_approval === "pending"}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await requestFederationApproval(competitionId);
                        toast.success("Pedido de aprovação enviado");
                        await qc.invalidateQueries({ queryKey: ["competition", competitionId] });
                      } catch (err: any) {
                        toast.error(err.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Federação: {competition.federation_approval ?? "none"}
                  </Button>
                )}
              </div>
            </section>

        {(true) && (
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold">Lutas</h2>
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
                      R{m.round_index + 1} · Luta {m.match_index + 1} · Mat {m.mat_number}
                    </span>
                    <span className="uppercase tracking-wider">
                      {m.status === "queued"
                        ? "Na fila"
                        : m.status === "live"
                          ? "Ao vivo"
                          : m.status === "finished"
                            ? "Terminada"
                            : m.status}
                    </span>
                  </div>
                  {isManager && (
                    <div className="mb-3 flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Início previsto
                        </Label>
                        <Input
                          type="datetime-local"
                          className="h-8 w-[200px]"
                          defaultValue={
                            m.estimated_start
                              ? new Date(m.estimated_start).toISOString().slice(0, 16)
                              : ""
                          }
                          onBlur={async (e) => {
                            const v = e.target.value;
                            try {
                              await updateMatch(m.id, {
                                estimated_start: v ? new Date(v).toISOString() : null,
                              });
                              await qc.invalidateQueries({ queryKey: ["matches", competitionId] });
                            } catch (err: any) {
                              toast.error(err.message);
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Tatâmi
                        </Label>
                        <Input
                          type="number"
                          className="h-8 w-20"
                          defaultValue={m.mat_number}
                          onBlur={async (e) => {
                            const n = Number(e.target.value);
                            if (!Number.isFinite(n)) return;
                            try {
                              await updateMatch(m.id, { mat_number: n });
                              await qc.invalidateQueries({ queryKey: ["matches", competitionId] });
                            } catch (err: any) {
                              toast.error(err.message);
                            }
                          }}
                        />
                      </div>
                      <Link
                        to="/mesa/$competitionId/$mat"
                        params={{
                          competitionId,
                          mat: String(m.mat_number || 1),
                        }}
                        search={{}}
                        className="text-xs text-primary hover:underline self-center"
                        target="_blank"
                      >
                        Mesa {m.mat_number || 1}
                      </Link>
                      <Link
                        to="/scoreboard/$matchId"
                        params={{ matchId: m.id }}
                        className="text-xs text-primary hover:underline self-center"
                        target="_blank"
                      >
                        Pontuar
                      </Link>
                      <Link
                        to="/display/mat/$competitionId/$mat"
                        params={{
                          competitionId,
                          mat: String(m.mat_number || 1),
                        }}
                        className="text-xs text-white/50 hover:underline self-center"
                        target="_blank"
                      >
                        Display
                      </Link>
                      {m.status === "finished" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-white/15 h-8 self-center"
                          onClick={async () => {
                            try {
                              await reopenMatch(m.id);
                              toast.success("Luta reaberta — podes corrigir o resultado");
                              await refresh();
                            } catch (err: any) {
                              toast.error(err.message);
                            }
                          }}
                        >
                          Reabrir
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { id: m.athlete_a_id, name: m.athlete_a?.full_name ?? "BYE / TBD" },
                      { id: m.athlete_b_id, name: m.athlete_b?.full_name ?? "BYE / TBD" },
                    ].map((side) => (
                      <button
                        key={side.id ?? side.name}
                        type="button"
                        disabled={!isManager || !side.id || m.status === "finished"}
                        onClick={() => side.id && void win(m.id, side.id)}
                        className={cn(
                          "border border-border px-3 py-3 text-left text-sm font-medium transition",
                          m.winner_id === side.id && "border-primary bg-primary/15",
                          isManager && side.id && m.status !== "finished" && "hover:border-primary/50",
                        )}
                      >
                        {side.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {matches.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Ainda sem lutas — gera chaves acima.
                </p>
              )}
            </div>
          </section>
        )}
          </div>
        )}
      </div>
    </AppChrome>
  );
}
