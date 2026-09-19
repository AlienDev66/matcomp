import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  cancelJoinRequest,
  fetchAllAcademies,
  fetchMyAthleteMemberships,
  fetchMyJoinRequests,
  requestJoinAcademy,
} from "@/lib/competition/api";
import { JOIN_STATUS_LABEL } from "@/lib/competition/types";
import { AppChrome } from "@/components/AppChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/join-academy")({
  head: () => ({ meta: [{ title: "Juntar-me a uma academia — MatComp" }] }),
  component: JoinAcademyPage,
});

function JoinAcademyPage() {
  const qc = useQueryClient();
  const { data: academies = [], isLoading } = useQuery({
    queryKey: ["all-academies"],
    queryFn: fetchAllAcademies,
  });
  const { data: myRequests = [] } = useQuery({
    queryKey: ["my-join-requests"],
    queryFn: fetchMyJoinRequests,
  });
  const { data: myAthletes = [] } = useQuery({
    queryKey: ["my-athlete-memberships"],
    queryFn: fetchMyAthleteMemberships,
  });

  const [query, setQuery] = useState("");
  const [academyId, setAcademyId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const blockedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of myRequests) {
      if (r.status === "pending" || r.status === "accepted") ids.add(r.academy_id);
    }
    for (const a of myAthletes) {
      if (a.academy_id) ids.add(a.academy_id);
    }
    return ids;
  }, [myRequests, myAthletes]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return academies.filter((a) => {
      if (blockedIds.has(a.id)) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.city ?? "").toLowerCase().includes(q) ||
        (a.slug ?? "").toLowerCase().includes(q)
      );
    });
  }, [academies, blockedIds, query]);

  const selected = academies.find((a) => a.id === academyId);
  const pending = myRequests.filter((r) => r.status === "pending");
  const rejected = myRequests.filter((r) => r.status === "rejected");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academyId) return toast.error("Escolhe uma academia");
    setBusy(true);
    try {
      await requestJoinAcademy(academyId, message);
      toast.success("Pedido enviado — o coach tem de aceitar");
      setMessage("");
      setAcademyId("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-join-requests"] }),
        qc.invalidateQueries({ queryKey: ["my-athlete-memberships"] }),
      ]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar pedido");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await cancelJoinRequest(id);
      toast.success("Pedido cancelado");
      await qc.invalidateQueries({ queryKey: ["my-join-requests"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <AppChrome title="Membership">
      <div className="mx-auto max-w-lg space-y-8">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">
            Atleta
          </p>
          <h1 className="font-display text-3xl font-bold">Juntar-me a uma academia</h1>
          <p className="text-sm text-white/50">
            Escolhe onde treinas. Só depois do coach aceitar podes inscrever-te em eventos por essa
            academia.
          </p>
        </div>

        {myAthletes.length > 0 && (
          <div className="border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm">
            <p className="inline-flex items-center gap-2 font-medium text-emerald-200">
              <Check className="h-4 w-4" />
              Já estás em {(myAthletes[0] as any).academies?.name ?? "uma academia"}
            </p>
            <p className="mt-1 text-xs text-white/45">
              Podes pedir outra academia; ao ser aceite, a associação ativa muda para a nova.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4 border border-white/10 bg-[#121214] p-5">
          <div className="space-y-2">
            <Label>Procurar academia</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome ou cidade…"
                className="rounded-none border-white/10 bg-transparent pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Seleciona</Label>
            {isLoading ? (
              <p className="text-sm text-white/40">A carregar…</p>
            ) : available.length === 0 ? (
              <p className="border border-dashed border-white/15 px-3 py-6 text-center text-xs text-white/40">
                Nenhuma academia disponível com este filtro.
              </p>
            ) : (
              <ul className="max-h-56 overflow-y-auto divide-y divide-white/5 border border-white/10">
                {available.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setAcademyId(a.id)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm transition ${
                        academyId === a.id
                          ? "bg-primary/15 text-white"
                          : "hover:bg-white/[0.03] text-white/80"
                      }`}
                    >
                      <span>
                        <span className="font-medium">{a.name}</span>
                        {a.city && (
                          <span className="mt-0.5 block text-xs text-white/40">{a.city}</span>
                        )}
                      </span>
                      {academyId === a.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selected && (
              <p className="text-xs text-white/40">
                Selecionada: <span className="text-white/70">{selected.name}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Mensagem ao coach (opcional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Olá, treino connosco desde…"
              rows={3}
              className="rounded-none border-white/10 bg-transparent"
            />
          </div>

          <Button
            type="submit"
            disabled={busy || !academyId}
            className="w-full rounded-none bg-primary hover:bg-primary/90"
          >
            {busy ? "A enviar…" : "Enviar pedido"}
          </Button>
        </form>

        {pending.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">À espera de aprovação</h2>
            <div className="space-y-2">
              {pending.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 border border-amber-500/25 bg-amber-500/5 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{r.academy?.name}</p>
                    <p className="text-xs text-amber-400/90">{JOIN_STATUS_LABEL[r.status]}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-white/50 hover:text-white"
                    onClick={() => void cancel(r.id)}
                  >
                    Cancelar
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {rejected.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-display text-lg font-semibold text-white/70">Rejeitados</h2>
            <p className="text-xs text-white/40">Podes voltar a pedir — escolhe a academia acima.</p>
            <ul className="space-y-1 text-sm text-white/45">
              {rejected.map((r) => (
                <li key={r.id}>{r.academy?.name}</li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-sm text-white/40">
          <Link to="/membership" className="text-primary hover:underline">
            ← Membership
          </Link>
        </p>
      </div>
    </AppChrome>
  );
}
