import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createOrganizer } from "@/lib/competition/organizers";
import { AppChrome } from "@/components/AppChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/organizer/new")({
  head: () => ({ meta: [{ title: "Candidatar-se a organizador — MatComp" }] }),
  component: ApplyOrganizerPage,
});

const STEPS = ["Organização", "Faturação", "Termos"] as const;

function ApplyOrganizerPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("Portugal");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");

  const [billingName, setBillingName] = useState("");
  const [billingEmail, setBillingEmail] = useState(user?.email ?? "");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [billingCountry, setBillingCountry] = useState("Portugal");
  const [vat, setVat] = useState("");

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptBilling, setAcceptBilling] = useState(false);

  const next = () => {
    if (step === 0) {
      if (!name.trim()) return toast.error("Indica o nome da organização");
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!billingName.trim() || !address1.trim() || !city.trim() || !billingCountry.trim()) {
        return toast.error("Preenche nome de faturação, morada, cidade e país");
      }
      setStep(2);
      return;
    }
  };

  const submit = async () => {
    if (!acceptTerms || !acceptBilling) {
      return toast.error("Aceita os termos e a política de faturação/créditos");
    }
    setBusy(true);
    try {
      const org = await createOrganizer({
        name,
        legal_name: legalName || name,
        description,
        website_url: website,
        country,
        phone,
        contact_email: contactEmail,
        billing_email: billingEmail,
        billing_name: billingName,
        billing_address_line1: address1,
        billing_address_line2: address2,
        billing_city: city,
        billing_postal: postal,
        billing_country: billingCountry,
        vat_number: vat,
        acceptAgreements: true,
      });
      toast.success("Organização criada — recebeste 20 créditos de boas-vindas");
      void navigate({ to: "/organizer/$slug", params: { slug: org.slug } });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppChrome title="Candidatar-se">
      <div className="mx-auto max-w-xl space-y-8">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
            <Link to="/organizer">
              <ArrowLeft className="h-4 w-4 mr-1" /> Organizações
            </Link>
          </Button>
          <h1 className="font-display text-3xl font-bold">Candidatar-se a organizador</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Como no Smoothcomp: crias uma organização, defines faturação (e VAT se aplicável),
            aceitas os termos e recebes créditos para gerir eventos.
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

        {step === 0 && (
          <div className="space-y-4 border border-border bg-card/40 p-5">
            <div>
              <Label>Nome da organização *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex. Open Norte Events"
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Uso interno — deve identificar facilmente quem organiza.
              </p>
            </div>
            <div>
              <Label>Nome legal / empresa</Label>
              <Input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Igual ao nome se fores particular"
              />
            </div>
            <div>
              <Label>Descrição pública</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Quem sois e que tipo de eventos organizais…"
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>País</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Website</Label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
              />
            </div>
            <div>
              <Label>Email de contacto</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <Button type="button" className="w-full bg-primary hover:bg-primary/90" onClick={next}>
              Continuar <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 border border-border bg-card/40 p-5">
            <p className="text-sm text-white/50">
              Dados usados em faturas e para créditos quando aprovas inscritos (modelo Smoothcomp).
            </p>
            <div>
              <Label>Nome na fatura *</Label>
              <Input value={billingName} onChange={(e) => setBillingName(e.target.value)} />
            </div>
            <div>
              <Label>Email de faturação</Label>
              <Input
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Morada *</Label>
              <Input value={address1} onChange={(e) => setAddress1(e.target.value)} />
            </div>
            <div>
              <Label>Morada (linha 2)</Label>
              <Input value={address2} onChange={(e) => setAddress2(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Cidade *</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <Label>Código postal</Label>
                <Input value={postal} onChange={(e) => setPostal(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>País de faturação *</Label>
                <Input value={billingCountry} onChange={(e) => setBillingCountry(e.target.value)} />
              </div>
              <div>
                <Label>NIF / VAT (UE)</Label>
                <Input
                  value={vat}
                  onChange={(e) => setVat(e.target.value)}
                  placeholder="PT123456789"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Nota: a verificação de cartão / taxa de abertura (€12,50 no Smoothcomp) fica para quando
              o Stripe estiver activo. Por agora gravamos os dados e damos 20 créditos demo.
            </p>
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
            <div className="space-y-3 text-sm text-white/60 leading-relaxed">
              <p>
                Ao criares a organização, tornas-te responsável pelos eventos que publicas, pelas
                inscrições e pela comunicação com atletas. A MatComp fornece a plataforma; o
                organizador é o dono do evento.
              </p>
              <p>
                Os créditos são usados quando aprovas inscritos (modelo Smoothcomp). Recebes{" "}
                <strong className="text-white">20 créditos</strong> de boas-vindas.
              </p>
            </div>
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
              />
              <span>Aceito os termos de uso da MatComp para organizadores.</span>
            </label>
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={acceptBilling}
                onChange={(e) => setAcceptBilling(e.target.checked)}
              />
              <span>
                Confirmo os dados de faturação e compreendo o sistema de créditos / cobrança por
                inscrição aprovada.
              </span>
            </label>
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
                {busy ? "A criar…" : "Criar organização"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppChrome>
  );
}
