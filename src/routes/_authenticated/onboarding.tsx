import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createAcademy } from "@/lib/competition/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { slugify } from "@/lib/competition/types";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Criar academia — MatComp" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const previewSlug = slugify(name) || "academia";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Indica o nome da academia");
    setBusy(true);
    try {
      const academy = await createAcademy({ name, city });
      toast.success(`${academy.name} criada`);
      void navigate({ to: "/a/$slug", params: { slug: academy.slug } });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar academia");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 space-y-8">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
          <Link to="/home">
            <ArrowLeft className="h-4 w-4 mr-1" /> Início
          </Link>
        </Button>
        <div className="text-center space-y-2">
          <Logo className="mx-auto h-12 w-12" />
          <h1 className="font-display text-3xl font-bold">Cria a tua academia</h1>
          <p className="text-sm text-muted-foreground">
            Em menos de um minuto tens um espaço para torneios e atletas.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card/50 p-6">
        <div>
          <Label htmlFor="academy">Nome da academia</Label>
          <Input
            id="academy"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team FS BJJ"
            required
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="city">Cidade (opcional)</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lisboa" />
        </div>
        <p className="text-xs text-muted-foreground">
          URL pública: <span className="text-foreground font-medium">/a/{previewSlug}</span>
        </p>
        <Button type="submit" disabled={busy} className="w-full min-h-12 bg-primary hover:bg-primary/90">
          {busy ? "A criar…" : "Criar academia"}
        </Button>
      </form>
    </div>
  );
}
