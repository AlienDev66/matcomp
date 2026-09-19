import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  addOrganizerMemberByEmail,
  canManageOrganizer,
  fetchOrganizerBySlug,
  fetchOrganizerCreditLedger,
  fetchOrganizerEvents,
  fetchOrganizerFederations,
  fetchOrganizerMembers,
  purchaseOrganizerCredits,
  removeOrganizerMember,
  updateOrganizer,
  updateOrganizerMemberRole,
  type OrganizerMemberRole,
} from "@/lib/competition/organizers";
import { AppChrome } from "@/components/AppChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarPlus, Copy, ExternalLink } from "lucide-react";
import { STATUS_LABEL } from "@/lib/competition/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/organizer/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — Organizer Manager` }] }),
  component: OrganizerManagerPage,
});

type Tab =
  | "events"
  | "credits"
  | "billing"
  | "payments"
  | "federations"
  | "staff"
  | "public";

const TABS: { id: Tab; label: string }[] = [
  { id: "events", label: "Eventos" },
  { id: "credits", label: "Créditos" },
  { id: "billing", label: "Faturação" },
  { id: "payments", label: "Pagamentos" },
  { id: "federations", label: "Federações" },
  { id: "staff", label: "Admins & Staff" },
  { id: "public", label: "Página pública" },
];

function OrganizerManagerPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("events");
  const [busy, setBusy] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<OrganizerMemberRole>("staff");

  const { data: org, isLoading } = useQuery({
    queryKey: ["organizer", slug],
    queryFn: () => fetchOrganizerBySlug(slug),
  });
  const { data: canManage } = useQuery({
    queryKey: ["can-manage-org", org?.id],
    queryFn: () => canManageOrganizer(org!.id),
    enabled: !!org,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["org-events", org?.id],
    queryFn: () => fetchOrganizerEvents(org!.id),
    enabled: !!org,
  });
  const { data: ledger = [] } = useQuery({
    queryKey: ["org-credits", org?.id],
    queryFn: () => fetchOrganizerCreditLedger(org!.id),
    enabled: !!org && tab === "credits",
  });
  const { data: members = [] } = useQuery({
    queryKey: ["org-members", org?.id],
    queryFn: () => fetchOrganizerMembers(org!.id),
    enabled: !!org && tab === "staff",
  });
  const { data: fedLinks = [] } = useQuery({
    queryKey: ["org-feds", org?.id],
    queryFn: () => fetchOrganizerFederations(org!.id),
    enabled: !!org && tab === "federations",
  });

  const refreshOrg = async () => {
    await qc.invalidateQueries({ queryKey: ["organizer", slug] });
    await qc.invalidateQueries({ queryKey: ["my-organizers"] });
  };

  const stats = useMemo(() => {
    const live = events.filter((e: any) => e.status === "live" || e.status === "registration").length;
    const finished = events.filter((e: any) => e.status === "finished").length;
    return { total: events.length, live, finished };
  }, [events]);

  if (isLoading) {
    return (
      <AppChrome>
        <p className="text-white/40">A carregar…</p>
      </AppChrome>
    );
  }

  if (!org) {
    return (
      <AppChrome>
        <p className="text-white/50">Organização não encontrada.</p>
        <Button asChild variant="outline" className="mt-4 border-white/15">
          <Link to="/organizer">Voltar</Link>
        </Button>
      </AppChrome>
    );
  }

  return (
    <AppChrome title="Organizer Manager">
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border border-white/10 bg-white/[0.03] p-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-primary">Organizer Manager</p>
            <h1 className="font-display text-3xl font-bold mt-1">{org.name}</h1>
            <p className="text-sm text-white/45 mt-2">
              Saldo: <strong className="text-white">{org.credits_balance ?? 0}</strong> créditos ·{" "}
              {stats.total} eventos
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-white/15">
              <Link to="/o/$slug" params={{ slug: org.slug }} target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" /> Página pública
              </Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link to="/events/new" search={{ organizer: org.id }}>
                <CalendarPlus className="mr-2 h-4 w-4" /> Criar evento
              </Link>
            </Button>
          </div>
        </header>

        <nav className="flex flex-wrap gap-1 border-b border-white/10 pb-px">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-3 py-2 text-xs uppercase tracking-wider border-b-2 transition",
                tab === t.id
                  ? "border-primary text-white"
                  : "border-transparent text-white/40 hover:text-white/70",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "events" && (
          <section className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm text-white/50">
              <span>Total: {stats.total}</span>
              <span>Activos: {stats.live}</span>
              <span>Terminados: {stats.finished}</span>
            </div>
            <ul className="divide-y divide-white/10 border border-white/10">
              {events.map((ev: any) => (
                <li key={ev.id}>
                  <Link
                    to="/events/$competitionId"
                    params={{ competitionId: ev.id }}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-white/[0.03]"
                  >
                    <span className="font-medium">{ev.name}</span>
                    <span className="text-xs text-white/40">
                      {STATUS_LABEL[ev.status as keyof typeof STATUS_LABEL] ?? ev.status}
                    </span>
                  </Link>
                </li>
              ))}
              {events.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-white/40">
                  Sem eventos. Cria o primeiro a partir deste manager.
                </li>
              )}
            </ul>
          </section>
        )}

        {tab === "credits" && (
          <section className="space-y-4">
            <div className="border border-white/10 p-5 space-y-3">
              <p className="text-sm text-white/50">
                Saldo actual:{" "}
                <strong className="text-2xl text-white font-display">{org.credits_balance ?? 0}</strong>
              </p>
              <p className="text-xs text-white/40">
                No Smoothcomp os créditos descem quando aprovas inscritos. Aqui podes comprar packs
                demo (sem Stripe ainda).
              </p>
              <div className="flex flex-wrap gap-2">
                {[20, 50, 100].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/15"
                    disabled={!canManage || busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await purchaseOrganizerCredits(org.id, n);
                        toast.success(`+${n} créditos`);
                        await refreshOrg();
                        await qc.invalidateQueries({ queryKey: ["org-credits", org.id] });
                      } catch (err: any) {
                        toast.error(err.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Comprar {n}
                  </Button>
                ))}
              </div>
            </div>
            <h3 className="font-display font-semibold">Histórico</h3>
            <ul className="text-sm divide-y divide-white/10 border border-white/10">
              {ledger.map((row) => (
                <li key={row.id} className="flex justify-between px-4 py-2">
                  <span className="text-white/60">{row.reason}</span>
                  <span className={row.delta >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {row.delta >= 0 ? "+" : ""}
                    {row.delta}
                  </span>
                </li>
              ))}
              {ledger.length === 0 && (
                <li className="px-4 py-6 text-center text-white/35">Sem movimentos</li>
              )}
            </ul>
          </section>
        )}

        {tab === "billing" &&
          (canManage ? (
            <BillingForm org={org} busy={busy} setBusy={setBusy} onSaved={refreshOrg} />
          ) : (
            <p className="text-sm text-white/40">Só admins podem editar faturação.</p>
          ))}

        {tab === "payments" &&
          (canManage ? (
            <PaymentsForm org={org} busy={busy} setBusy={setBusy} onSaved={refreshOrg} />
          ) : (
            <p className="text-sm text-white/40">Só admins podem editar pagamentos.</p>
          ))}

        {tab === "federations" && (
          <section className="space-y-4">
            <div className="border border-white/10 p-5 space-y-3">
              <h3 className="font-display font-semibold">Código da organização</h3>
              <p className="text-sm text-white/50">
                Envia este código ao admin da federação para te ligarem (como no Smoothcomp).
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="bg-black/40 border border-white/10 px-3 py-2 font-mono tracking-wider">
                  {org.organization_code}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/15"
                  onClick={async () => {
                    await navigator.clipboard.writeText(org.organization_code);
                    toast.success("Código copiado");
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                </Button>
              </div>
            </div>
            <h3 className="font-display font-semibold">Federações ligadas</h3>
            <ul className="text-sm text-white/60 space-y-1 border border-white/10 p-4">
              {fedLinks.map((row: any) => (
                <li key={row.id}>
                  • {row.federation?.name ?? "—"}
                  {row.federation?.slug && (
                    <Link
                      to="/f/$federationSlug"
                      params={{ federationSlug: row.federation.slug }}
                      className="ml-2 text-primary hover:underline"
                    >
                      ver
                    </Link>
                  )}
                </li>
              ))}
              {fedLinks.length === 0 && (
                <li className="text-white/35">Ainda não estás ligado a nenhuma federação.</li>
              )}
            </ul>
          </section>
        )}

        {tab === "staff" && canManage && (
          <section className="space-y-4">
            <p className="text-sm text-white/50">
              Roles: <strong className="text-white/70">owner/admin</strong> (tudo),{" "}
              <strong className="text-white/70">staff</strong> (acesso limitado — dia do evento).
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="email da conta MatComp"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                className="max-w-xs"
              />
              <Select value={staffRole} onValueChange={(v) => setStaffRole(v as OrganizerMemberRole)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="staff">staff</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                className="bg-primary hover:bg-primary/90"
                disabled={busy || !staffEmail.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await addOrganizerMemberByEmail(org.id, staffEmail, staffRole);
                    toast.success("Membro adicionado");
                    setStaffEmail("");
                    await qc.invalidateQueries({ queryKey: ["org-members", org.id] });
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Adicionar
              </Button>
            </div>
            <ul className="divide-y divide-white/10 border border-white/10">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="font-mono text-xs text-white/50">{m.user_id.slice(0, 8)}…</span>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={m.role}
                      onValueChange={async (v) => {
                        try {
                          await updateOrganizerMemberRole(m.id, v as OrganizerMemberRole);
                          await qc.invalidateQueries({ queryKey: ["org-members", org.id] });
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }}
                    >
                      <SelectTrigger className="w-28 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">owner</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="staff">staff</SelectItem>
                      </SelectContent>
                    </Select>
                    {m.role !== "owner" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-rose-400"
                        onClick={async () => {
                          await removeOrganizerMember(m.id);
                          await qc.invalidateQueries({ queryKey: ["org-members", org.id] });
                        }}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "public" && canManage && (
          <PublicProfileForm org={org} busy={busy} setBusy={setBusy} onSaved={refreshOrg} />
        )}
      </div>
    </AppChrome>
  );
}

function BillingForm({
  org,
  busy,
  setBusy,
  onSaved,
}: {
  org: NonNullable<Awaited<ReturnType<typeof fetchOrganizerBySlug>>>;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  return (
    <form
      className="space-y-3 border border-white/10 p-5 max-w-xl"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        try {
          await updateOrganizer(org.id, {
            billing_name: String(fd.get("billing_name") || ""),
            billing_email: String(fd.get("billing_email") || "") || null,
            billing_address_line1: String(fd.get("line1") || ""),
            billing_address_line2: String(fd.get("line2") || "") || null,
            billing_city: String(fd.get("city") || ""),
            billing_postal: String(fd.get("postal") || "") || null,
            billing_country: String(fd.get("country") || ""),
            vat_number: String(fd.get("vat") || "") || null,
          });
          toast.success("Faturação actualizada");
          await onSaved();
        } catch (err: any) {
          toast.error(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="font-display font-semibold">Billing info</h3>
      <div>
        <Label>Nome</Label>
        <Input name="billing_name" defaultValue={org.billing_name ?? ""} required />
      </div>
      <div>
        <Label>Email</Label>
        <Input name="billing_email" type="email" defaultValue={org.billing_email ?? ""} />
      </div>
      <div>
        <Label>Morada</Label>
        <Input name="line1" defaultValue={org.billing_address_line1 ?? ""} required />
      </div>
      <div>
        <Label>Morada 2</Label>
        <Input name="line2" defaultValue={org.billing_address_line2 ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Cidade</Label>
          <Input name="city" defaultValue={org.billing_city ?? ""} required />
        </div>
        <div>
          <Label>CP</Label>
          <Input name="postal" defaultValue={org.billing_postal ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>País</Label>
          <Input name="country" defaultValue={org.billing_country ?? ""} required />
        </div>
        <div>
          <Label>VAT / NIF</Label>
          <Input name="vat" defaultValue={org.vat_number ?? ""} />
        </div>
      </div>
      <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">
        Guardar
      </Button>
    </form>
  );
}

function PaymentsForm({
  org,
  busy,
  setBusy,
  onSaved,
}: {
  org: NonNullable<Awaited<ReturnType<typeof fetchOrganizerBySlug>>>;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  return (
    <form
      className="space-y-3 border border-white/10 p-5 max-w-xl"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        try {
          await updateOrganizer(org.id, {
            stripe_publishable_key: String(fd.get("pk") || "") || null,
            stripe_secret_key_ref: String(fd.get("sk") || "") || null,
            custom_payment_instructions: String(fd.get("custom") || "") || null,
          });
          toast.success("Pagamentos guardados");
          await onSaved();
        } catch (err: any) {
          toast.error(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="font-display font-semibold">Pagamentos online (Stripe)</h3>
      <p className="text-xs text-white/40">
        Como no Smoothcomp: cola as API keys da tua conta Stripe. O secret não deve ir para o
        browser em produção — aqui é MVP de configuração.
      </p>
      <div>
        <Label>Stripe publishable key</Label>
        <Input name="pk" defaultValue={org.stripe_publishable_key ?? ""} placeholder="pk_live_…" />
      </div>
      <div>
        <Label>Stripe secret key (ref)</Label>
        <Input name="sk" defaultValue={org.stripe_secret_key_ref ?? ""} placeholder="sk_live_…" />
      </div>
      <div>
        <Label>Instruções de pagamento custom (transferência / no local)</Label>
        <Textarea
          name="custom"
          rows={4}
          defaultValue={org.custom_payment_instructions ?? ""}
          placeholder="IBAN, MB Way, pagar na mesa…"
        />
      </div>
      <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">
        Guardar
      </Button>
    </form>
  );
}

function PublicProfileForm({
  org,
  busy,
  setBusy,
  onSaved,
}: {
  org: NonNullable<Awaited<ReturnType<typeof fetchOrganizerBySlug>>>;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  return (
    <form
      className="space-y-3 border border-white/10 p-5 max-w-xl"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        try {
          await updateOrganizer(org.id, {
            name: String(fd.get("name") || org.name),
            description: String(fd.get("description") || "") || null,
            website_url: String(fd.get("website") || "") || null,
            contact_email: String(fd.get("email") || "") || null,
            is_public: fd.get("is_public") === "on",
          });
          toast.success("Perfil público actualizado");
          await onSaved();
        } catch (err: any) {
          toast.error(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="font-display font-semibold">Perfil público</h3>
      <p className="text-xs text-white/40">
        Visível em{" "}
        <Link to="/o/$slug" params={{ slug: org.slug }} className="text-primary hover:underline">
          /o/{org.slug}
        </Link>
      </p>
      <div>
        <Label>Nome</Label>
        <Input name="name" defaultValue={org.name} />
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea name="description" rows={4} defaultValue={org.description ?? ""} />
      </div>
      <div>
        <Label>Website</Label>
        <Input name="website" defaultValue={org.website_url ?? ""} />
      </div>
      <div>
        <Label>Email de contacto</Label>
        <Input name="email" type="email" defaultValue={org.contact_email ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_public" defaultChecked={org.is_public !== false} />
        Página pública visível
      </label>
      <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">
        Guardar
      </Button>
    </form>
  );
}
