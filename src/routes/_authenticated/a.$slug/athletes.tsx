import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  acceptJoinRequest,
  addAthleteByEmail,
  fetchAcademyBySlug,
  fetchAcademyJoinRequests,
  fetchAthletes,
  rejectJoinRequest,
  removeAthlete,
} from "@/lib/competition/api";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Check, Plus, Trash2, X } from "lucide-react";

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
  const { data: pending = [], isLoading: loadingPending } = useQuery({
    queryKey: ["academy-join-requests", academy?.id],
    queryFn: () => fetchAcademyJoinRequests(academy!.id),
    enabled: !!academy?.id,
  });

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const refresh = async () => {
    if (!academy) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["athletes", academy.id] }),
      qc.invalidateQueries({ queryKey: ["academy-join-requests", academy.id] }),
    ]);
  };

  const addByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academy) return;
    setBusy(true);
    try {
      await addAthleteByEmail(academy.id, email);
      toast.success("Atleta adicionado ao roster");
      setEmail("");
      setOpen(false);
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const accept = async (id: string) => {
    setBusy(true);
    try {
      await acceptJoinRequest(id);
      toast.success("Pedido aceite — atleta no roster");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reject = async (id: string) => {
    setBusy(true);
    try {
      await rejectJoinRequest(id);
      toast.success("Pedido rejeitado");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removeId) return;
    setBusy(true);
    try {
      await removeAthlete(removeId);
      toast.success("Atleta removido do roster");
      setRemoveId(null);
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removing = athletes.find((a) => a.id === removeId);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Atletas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Só contas MatComp — pedidos de adesão ou convite por email
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" /> Adicionar por email
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar conta MatComp</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              A pessoa tem de ter conta criada. Se ainda não tiver, pede-lhe para se registar e
              enviar pedido em Membership.
            </p>
            <form onSubmit={addByEmail} className="space-y-4">
              <div>
                <Label>Email da conta</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="atleta@email.com"
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90">
                {busy ? "A adicionar…" : "Adicionar ao roster"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Pedidos pendentes</h2>
        {loadingPending && <p className="text-sm text-muted-foreground">A carregar…</p>}
        {!loadingPending && pending.length === 0 && (
          <p className="text-sm text-muted-foreground rounded-2xl border border-border bg-card/20 px-5 py-6">
            Sem pedidos de adesão.
          </p>
        )}
        <div className="space-y-2">
          {pending.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-5 py-4"
            >
              <div>
                <p className="font-medium">{r.profile?.full_name ?? "Utilizador"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.profile?.email ?? r.user_id.slice(0, 8)}
                  {r.message ? ` · “${r.message}”` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => void accept(r.id)}
                >
                  <Check className="h-4 w-4 mr-1" /> Aceitar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  className="border-white/15"
                  onClick={() => void reject(r.id)}
                >
                  <X className="h-4 w-4 mr-1" /> Rejeitar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Roster</h2>
          <p className="text-xs text-muted-foreground">{athletes.length} ativos</p>
        </div>
        {isLoading && <p className="text-muted-foreground">A carregar…</p>}
        <div className="divide-y divide-border rounded-2xl border border-border bg-card/30">
          {athletes.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="font-medium">{a.full_name}</p>
                <p className="text-[10px] uppercase tracking-wider mt-0.5">
                  {a.user_id ? (
                    <span className="text-primary/80">Conta ligada</span>
                  ) : (
                    <span className="text-amber-400/90">Sem conta — remove ou pede registo</span>
                  )}
                  <span className="text-muted-foreground">
                    {" "}
                    · {a.belt} · {a.category}
                  </span>
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={busy}
                onClick={() => setRemoveId(a.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Remover
              </Button>
            </div>
          ))}
          {!isLoading && athletes.length === 0 && (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">Sem atletas ainda.</p>
          )}
        </div>
      </section>

      <AlertDialog open={!!removeId} onOpenChange={(o) => !o && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover do roster?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.full_name ?? "Este atleta"} deixa de representar a academia. Pode voltar a
              pedir adesão ou ser adicionado pelo email da conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmRemove();
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
