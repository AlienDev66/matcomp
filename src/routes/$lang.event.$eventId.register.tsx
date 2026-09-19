import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  fetchCompetition,
  fetchDivisions,
  fetchEntries,
  fetchMyAthleteMemberships,
  fetchMyProfile,
  markEntryPaid,
  resolveEntryPriceCents,
  updateMyAthlete,
  updateMyProfile,
} from "@/lib/competition/api";
import {
  BJJ_BELTS,
  buildDivisionTree,
  eligibilityWhy,
  uniqueAgeLabels,
  uniqueBelts,
  weightOptions,
} from "@/lib/competition/eligibility";
import { formatPrice, type CompetitionDivision } from "@/lib/competition/types";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowLeft, Lock } from "lucide-react";

const LANGS = ["pt", "en", "es"] as const;

export const Route = createFileRoute("/$lang/event/$eventId/register")({
  head: () => ({ meta: [{ title: "Inscrição — MatComp" }] }),
  component: RegisterWizardPage,
});

type Step = "details" | "entries" | "payment";

function RegisterWizardPage() {
  const { lang, eventId } = Route.useParams();
  const safeLang = LANGS.includes(lang as (typeof LANGS)[number]) ? lang : "pt";
  const { session, loading: authLoading } = useAuth();
  const qc = useQueryClient();

  const { data: competition } = useQuery({
    queryKey: ["competition", eventId],
    queryFn: () => fetchCompetition(eventId),
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ["divisions", eventId],
    queryFn: () => fetchDivisions(eventId),
  });
  const { data: entries = [] } = useQuery({
    queryKey: ["entries", eventId],
    queryFn: () => fetchEntries(eventId),
  });
  const { data: myAthletes = [] } = useQuery({
    queryKey: ["my-athlete-memberships"],
    queryFn: fetchMyAthleteMemberships,
    enabled: !!session,
  });
  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: fetchMyProfile,
    enabled: !!session,
  });

  const [step, setStep] = useState<Step>("details");
  const [athleteId, setAthleteId] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [belt, setBelt] = useState("white");
  const [weightKg, setWeightKg] = useState("");
  const [detailsLoaded, setDetailsLoaded] = useState(false);

  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selBelt, setSelBelt] = useState("");
  const [selAge, setSelAge] = useState("");
  const [selWeightId, setSelWeightId] = useState("");
  const [cart, setCart] = useState<CompetitionDivision[]>([]);
  const [tosOpen, setTosOpen] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  const athlete =
    myAthletes.find((a) => a.id === (athleteId || myAthletes[0]?.id)) ?? myAthletes[0] ?? null;

  useEffect(() => {
    if (!session || !profile || !athlete || detailsLoaded) return;
    setPhone(profile.phone ?? "");
    setNationality(profile.nationality ?? athlete.country_code ?? "");
    setGender(profile.gender ?? "");
    setBirthDate(profile.birth_date ?? athlete.birth_date ?? "");
    setBelt(athlete.belt ?? "white");
    setWeightKg(athlete.weight_kg != null ? String(athlete.weight_kg) : "");
    setAthleteId(athlete.id);
    setDetailsLoaded(true);
  }, [session, profile, athlete, detailsLoaded]);

  const athleteForElig = useMemo(
    () =>
      athlete
        ? {
            belt,
            birth_date: birthDate || athlete.birth_date,
            weight_kg: weightKg ? Number(weightKg) : athlete.weight_kg,
            category: athlete.category,
            gender: gender || null,
          }
        : undefined,
    [athlete, belt, birthDate, weightKg, gender],
  );

  const tree = useMemo(
    () => buildDivisionTree(divisions, athleteForElig),
    [divisions, athleteForElig],
  );

  const alreadyIn = !!athlete && entries.some((e) => e.athlete_id === athlete.id);
  const myDivisionIds = useMemo(
    () => new Set(entries.filter((e) => e.athlete_id === athlete?.id).map((e) => e.division_id)),
    [entries, athlete?.id],
  );

  if (authLoading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#0a0a0b] text-white/40">A carregar…</div>
    );
  }
  if (!session) {
    return <Navigate to="/auth" />;
  }

  const saveDetails = async () => {
    if (!athlete) {
      toast.error("Precisas de estar numa academia aceite");
      return;
    }
    setBusy(true);
    try {
      await updateMyProfile({
        phone: phone.trim() || null,
        nationality: nationality.trim() || null,
        gender: gender || null,
        birth_date: birthDate || null,
      });
      await updateMyAthlete(athlete.id, {
        belt,
        birth_date: birthDate || null,
        weight_kg: weightKg ? Number(weightKg) : null,
      });
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
      await qc.invalidateQueries({ queryKey: ["my-athlete-memberships"] });
      setStep("entries");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const activeGroup = tree.find((t) => t.group.id === expandedGroup);
  const belts = activeGroup ? uniqueBelts(activeGroup.entries) : [];
  const ages = activeGroup ? uniqueAgeLabels(activeGroup.entries, selBelt || null) : [];
  const weights = activeGroup
    ? weightOptions(activeGroup.entries, selBelt || null, selAge || null)
    : [];

  const addToCart = () => {
    const entry =
      (selWeightId && activeGroup?.entries.find((e) => e.id === selWeightId)) ||
      (activeGroup?.entries.length === 1 ? activeGroup.entries[0] : null);
    if (!entry) {
      toast.error("Escolhe cinturão, idade e peso");
      return;
    }
    if (athleteForElig) {
      const why = eligibilityWhy(entry, athleteForElig);
      if (why) {
        toast.error(why);
        return;
      }
    }
    if (myDivisionIds.has(entry.id) || cart.some((c) => c.id === entry.id)) {
      toast.message("Já tens esta categoria no carrinho ou inscrita");
      return;
    }
    setCart((prev) => [...prev, entry]);
    toast.success("Adicionado ao carrinho — podes adicionar o Absoluto também");
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.id !== id));

  const continuePayment = () => {
    if (!tosAccepted) {
      toast.error("Aceita os Termos de Serviço");
      return;
    }
    setTosOpen(false);
    setStep("payment");
  };

  const pay = async () => {
    if (cart.length === 0 || !athlete) return;
    setBusy(true);
    try {
      const { selfRegisterMany } = await import("@/lib/competition/api");
      const created = await selfRegisterMany(
        eventId,
        cart.map((c) => c.id),
      );
      const lineItems = cart.map((c, i) => ({
        name: c.name,
        amountCents: resolveEntryPriceCents(c.price_cents ?? 0, competition?.deadline_early_at),
        entryId: created[i].id,
      }));
      const amount = lineItems.reduce((s, li) => s + li.amountCents, 0);
      if (amount <= 0) {
        for (const e of created) {
          await markEntryPaid(e.id, { amount_paid_cents: 0 });
        }
        toast.success("Inscrições confirmadas");
        void qc.invalidateQueries({ queryKey: ["entries", eventId] });
        window.location.href = `/${safeLang}/event/${eventId}`;
        return;
      }
      try {
        const { createCheckoutSession } = await import("@/lib/stripe-checkout.server");
        const origin = window.location.origin;
        const result = await createCheckoutSession({
          data: {
            entryIds: created.map((e) => e.id),
            competitionId: eventId,
            competitionName: competition?.name ?? "Event",
            divisionName: cart.map((c) => c.name).join(" + "),
            lineItems,
            amountCents: amount,
            currency: cart[0]?.currency ?? "EUR",
            customerEmail: session.user.email ?? undefined,
            successUrl: `${origin}/payments?paid=1&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}/${safeLang}/event/${eventId}/register`,
          },
        });
        if (result.url) {
          window.location.href = result.url;
          return;
        }
        toast.success("Inscrições criadas — pagamento pendente");
      } catch (payErr: any) {
        toast.message("Inscrições criadas", {
          description: payErr?.message ?? "Configura Stripe para cobrar.",
        });
      }
      window.location.href = "/payments";
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const price = cart.reduce(
    (s, c) => s + resolveEntryPriceCents(c.price_cents ?? 0, competition?.deadline_early_at),
    0,
  );

  return (
    <div className="min-h-dvh bg-[#0a0a0b] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link
            to="/$lang/event/$eventId"
            params={{ lang: safeLang, eventId }}
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao evento
          </Link>
          <div className="flex items-center gap-2">
            <Logo className="h-7 w-7" />
            <span className="font-display text-xs font-bold tracking-widest uppercase">MatComp</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-primary">Inscrição</p>
          <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">
            {competition?.name ?? "Evento"}
          </h1>
        </div>

        <nav className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.18em]">
          {(
            [
              ["details", "Dados"],
              ["entries", "Categorias"],
              ["payment", "Pagamento"],
            ] as const
          ).map(([id, label]) => (
            <span
              key={id}
              className={cn(step === id ? "text-white font-semibold" : "text-white/35")}
            >
              {label}
            </span>
          ))}
        </nav>

        {alreadyIn && (
          <p className="border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Já tens inscrição(ões) neste evento — podes adicionar outra categoria (ex. Absoluto).{" "}
            <Link
              to="/$lang/event/$eventId"
              params={{ lang: safeLang, eventId }}
              className="underline"
            >
              Ver página
            </Link>
          </p>
        )}

        {!athlete && (
          <p className="border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            Precisas de uma academia aceite.{" "}
            <Link to="/join-academy" className="text-primary underline">
              Pedir adesão
            </Link>
          </p>
        )}

        {step === "details" && athlete && (
          <div className="space-y-6">
            {myAthletes.length > 1 && (
              <div className="space-y-2">
                <Label>Perfil / academia</Label>
                <Select
                  value={athleteId || athlete.id}
                  onValueChange={(id) => {
                    setAthleteId(id);
                    const a = myAthletes.find((x) => x.id === id);
                    if (a) {
                      setBelt(a.belt ?? "white");
                      setBirthDate(a.birth_date ?? birthDate);
                      setWeightKg(a.weight_kg != null ? String(a.weight_kg) : "");
                    }
                  }}
                >
                  <SelectTrigger className="rounded-none border-white/10 bg-[#141416]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {myAthletes.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.full_name} · {a.academies?.name ?? a.academy?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <section className="border border-white/10 bg-[#141416] p-5 space-y-4">
              <h2 className="font-display text-lg font-semibold">Os teus dados</h2>
              <Field locked label="Nome" value={profile?.full_name ?? athlete.full_name} />
              <Field locked label="Email" value={profile?.email ?? session.user.email ?? "—"} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Nacionalidade</Label>
                  <Input
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="mt-1.5 rounded-none border-white/10 bg-transparent"
                    placeholder="PT"
                  />
                </div>
                <div>
                  <Label>Género</Label>
                  <Select value={gender || "unset"} onValueChange={(v) => setGender(v === "unset" ? "" : v)}>
                    <SelectTrigger className="mt-1.5 rounded-none border-white/10 bg-transparent">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">—</SelectItem>
                      <SelectItem value="male">Masculino</SelectItem>
                      <SelectItem value="female">Feminino</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data de nascimento</Label>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="mt-1.5 rounded-none border-white/10 bg-transparent"
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5 rounded-none border-white/10 bg-transparent"
                    placeholder="+351…"
                  />
                </div>
              </div>
            </section>

            <section className="border border-white/10 bg-[#141416] p-5 space-y-4">
              <h2 className="font-display text-lg font-semibold">Cinturão · BJJ</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Cinturão</Label>
                  <Select value={belt} onValueChange={setBelt}>
                    <SelectTrigger className="mt-1.5 rounded-none border-white/10 bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BJJ_BELTS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Peso (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="mt-1.5 rounded-none border-white/10 bg-transparent"
                  />
                </div>
              </div>
            </section>

            <Button
              type="button"
              disabled={busy}
              className="rounded-none bg-primary hover:bg-primary/90"
              onClick={() => void saveDetails()}
            >
              Guardar e continuar
            </Button>
          </div>
        )}

        {step === "entries" && athlete && (
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <section className="border border-white/10 bg-[#141416] p-5 space-y-3">
                <h2 className="font-display text-lg font-semibold">Academia</h2>
                <p className="text-sm text-white/70">
                  {(athlete as any).academies?.name ?? (athlete as any).academy?.name ?? "—"}
                </p>
              </section>

              <section className="border border-white/10 bg-[#141416] overflow-hidden">
                <div className="bg-primary/90 px-4 py-2 text-sm font-medium">
                  Ao inscreveres-te aceitas os Termos de Serviço do evento.
                </div>
                <ul className="divide-y divide-white/5">
                  {tree.map((row) => {
                    const open = expandedGroup === row.group.id;
                    return (
                      <li key={row.group.id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm",
                            !row.eligible && "opacity-45",
                            open && "bg-white/[0.03]",
                          )}
                          onClick={() => {
                            if (!row.eligible) {
                              toast.message("N/A", { description: row.why ?? undefined });
                              return;
                            }
                            setExpandedGroup(open ? null : row.group.id);
                            setSelBelt("");
                            setSelAge("");
                            setSelWeightId("");
                          }}
                        >
                          <span className="font-medium">
                            {row.group.name}
                            {row.entries[0]?.price_cents != null && row.entries.length > 0 && (
                              <span className="text-white/40 font-normal">
                                {" "}
                                {formatPrice(
                                  resolveEntryPriceCents(
                                    row.entries[0].price_cents ?? 0,
                                    competition?.deadline_early_at,
                                  ),
                                  row.entries[0].currency,
                                )}
                              </span>
                            )}
                          </span>
                          {!row.eligible ? (
                            <span className="text-xs text-white/50">
                              N/A{" "}
                              <span className="text-primary">Porquê?</span>
                            </span>
                          ) : (
                            <span className="text-xs text-white/40">{open ? "−" : "+"}</span>
                          )}
                        </button>
                        {open && row.eligible && (
                          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
                            {belts.length > 0 && (
                              <Select
                                value={selBelt}
                                onValueChange={(v) => {
                                  setSelBelt(v);
                                  setSelAge("");
                                  setSelWeightId("");
                                }}
                              >
                                <SelectTrigger className="rounded-none border-white/10 bg-black/30">
                                  <SelectValue placeholder="Cinturão" />
                                </SelectTrigger>
                                <SelectContent>
                                  {belts.map((b) => (
                                    <SelectItem key={b} value={b}>
                                      {b}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {(ages.length > 0 || !belts.length) && (
                              <Select
                                value={selAge}
                                onValueChange={(v) => {
                                  setSelAge(v);
                                  setSelWeightId("");
                                }}
                              >
                                <SelectTrigger className="rounded-none border-white/10 bg-black/30">
                                  <SelectValue placeholder="Idade" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(ages.length ? ages : ["Adult"]).map((a) => (
                                    <SelectItem key={a} value={a}>
                                      {a}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Select value={selWeightId} onValueChange={setSelWeightId}>
                              <SelectTrigger className="rounded-none border-white/10 bg-black/30">
                                <SelectValue placeholder="Peso" />
                              </SelectTrigger>
                              <SelectContent>
                                {weights.map((w) => (
                                  <SelectItem key={w.id} value={w.id}>
                                    {w.weight_label
                                      ? `${w.weight_max_kg != null ? `-${w.weight_max_kg}` : w.weight_min_kg != null ? `+${w.weight_min_kg}` : ""} kg (${w.weight_label})`
                                      : w.name}
                                  </SelectItem>
                                ))}
                                {weights.length === 0 &&
                                  row.entries.map((w) => (
                                    <SelectItem key={w.id} value={w.id}>
                                      {w.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              className="sm:col-span-3 rounded-none bg-primary hover:bg-primary/90"
                              onClick={addToCart}
                            >
                              Adicionar inscrição
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {tree.length === 0 && (
                    <li className="px-4 py-8 text-center text-sm text-white/40">
                      Sem divisões neste evento.
                    </li>
                  )}
                </ul>
              </section>

              <Button
                type="button"
                variant="ghost"
                className="rounded-none text-white/50"
                onClick={() => setStep("details")}
              >
                ← Dados
              </Button>
            </div>

            <aside className="border border-white/10 bg-[#141416] p-4 h-fit space-y-3">
              <h3 className="font-display font-semibold">Inscrições pendentes</h3>
              <p className="text-xs text-white/40">
                Podes juntar categoria + Absoluto no mesmo checkout.
              </p>
              {cart.length > 0 ? (
                <>
                  <ul className="space-y-2">
                    {cart.map((c) => (
                      <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate">{c.name}</p>
                          <p className="text-xs text-white/40">
                            {formatPrice(
                              resolveEntryPriceCents(c.price_cents ?? 0, competition?.deadline_early_at),
                              c.currency,
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-white/40 hover:text-white shrink-0"
                          onClick={() => removeFromCart(c.id)}
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="bg-primary/80 px-3 py-2 text-sm font-semibold">
                    Total {formatPrice(price, cart[0]?.currency)}
                  </div>
                  <Button
                    type="button"
                    className="w-full rounded-none bg-emerald-600 hover:bg-emerald-500"
                    onClick={() => {
                      setTosAccepted(false);
                      setTosOpen(true);
                    }}
                  >
                    Continuar para pagamento
                  </Button>
                </>
              ) : (
                <p className="text-sm text-white/40">Ainda sem inscrição no carrinho.</p>
              )}
            </aside>
          </div>
        )}

        {step === "payment" && cart.length > 0 && (
          <div className="max-w-md mx-auto border border-white/10 bg-[#141416] p-6 space-y-4">
            <h2 className="font-display text-xl font-semibold">Carrinho</h2>
            <p className="text-sm text-white/70">{athlete?.full_name}</p>
            <ul className="space-y-2 text-sm">
              {cart.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0">
                    {formatPrice(
                      resolveEntryPriceCents(c.price_cents ?? 0, competition?.deadline_early_at),
                      c.currency,
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between text-sm border-t border-white/10 pt-3">
              <span>Total</span>
              <span className="font-semibold">{formatPrice(price, cart[0]?.currency)}</span>
            </div>
            <Button
              type="button"
              disabled={busy}
              className="w-full rounded-none bg-primary hover:bg-primary/90"
              onClick={() => void pay()}
            >
              {busy ? "…" : price > 0 ? "Pagar com Stripe" : "Confirmar inscrição gratuita"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-none text-white/50"
              onClick={() => setStep("entries")}
            >
              Voltar
            </Button>
          </div>
        )}
      </main>

      <Dialog open={tosOpen} onOpenChange={setTosOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto bg-[#141416] text-white border-white/15">
          <DialogHeader>
            <DialogTitle>Termos de Serviço</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-white/70">
            <div>
              <p className="font-semibold text-white/90 text-xs uppercase tracking-wider mb-2">
                MatComp
              </p>
              <p>
                Ao inscreveres-te, tornas-te cliente direto do organizador do evento. A MatComp é
                apenas a plataforma tecnológica e não garante a qualidade do evento.
              </p>
            </div>
            <div>
              <p className="font-semibold text-white/90 text-xs uppercase tracking-wider mb-2">
                {competition?.name}
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Reconheço o risco de lesões em desportos de contacto.</li>
                <li>Não responsabilizo o organizador por danos ou custos médicos.</li>
                <li>Os meus dados podem ser usados para comunicações do evento.</li>
              </ul>
              {competition?.refund_policy_url && (
                <a
                  href={competition.refund_policy_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline mt-2 inline-block"
                >
                  Política de reembolso
                </a>
              )}
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={tosAccepted}
                onCheckedChange={(v) => setTosAccepted(v === true)}
                className="mt-0.5"
              />
              <span>Aceito os Termos de Serviço</span>
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="destructive" onClick={() => setTosOpen(false)}>
              Recusar
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-500"
              onClick={continuePayment}
            >
              Aceitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, locked }: { label: string; value: string; locked?: boolean }) {
  return (
    <div>
      <Label className="text-white/50 inline-flex items-center gap-1">
        {label}
        {locked && <Lock className="h-3 w-3" />}
      </Label>
      <p className="mt-1 text-sm border border-white/10 bg-black/20 px-3 py-2 text-white/80">{value}</p>
    </div>
  );
}
