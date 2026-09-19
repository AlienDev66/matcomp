import { createFileRoute, Link } from "@tanstack/react-router";
import { AppChrome } from "@/components/AppChrome";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelJoinRequest,
  fetchMyAcademies,
  fetchMyAthleteMemberships,
  fetchMyJoinRequests,
} from "@/lib/competition/api";
import { JOIN_STATUS_LABEL } from "@/lib/competition/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/membership")({
  head: () => ({ meta: [{ title: "Membership — MatComp" }] }),
  component: MembershipPage,
});

function MembershipPage() {
  const qc = useQueryClient();
  const { data: academies = [] } = useQuery({ queryKey: ["my-academies"], queryFn: fetchMyAcademies });
  const { data: athletes = [] } = useQuery({
    queryKey: ["my-athlete-memberships"],
    queryFn: fetchMyAthleteMemberships,
  });
  const { data: requests = [] } = useQuery({
    queryKey: ["my-join-requests"],
    queryFn: fetchMyJoinRequests,
  });
  const pending = requests.filter((r) => r.status === "pending");
  const rejected = requests.filter((r) => r.status === "rejected");

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
      <div className="space-y-8 max-w-2xl">
        <div>
          <h1 className="font-display text-3xl font-bold">Membership</h1>
          <p className="text-sm text-white/50 mt-1">Academias onde treinas e onde és staff</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild className="rounded-none bg-primary hover:bg-primary/90">
            <Link to="/join-academy">
              <Users className="h-4 w-4 mr-2" /> Juntar-me a academia
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-none border-white/15">
            <Link to="/onboarding">
              <Plus className="h-4 w-4 mr-2" /> Criar academia
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-none border-white/15">
            <Link to="/payments">Pagamentos / check-in</Link>
          </Button>
        </div>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Onde treino</h2>
          {athletes.map((a: any) => (
            <div key={a.id} className="border border-white/10 bg-[#141416] px-4 py-3">
              <p className="font-medium">{a.academies?.name}</p>
              <p className="text-xs text-emerald-400/90 mt-0.5">Membro aceite · podes inscrever-te em eventos</p>
            </div>
          ))}
          {pending.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-amber-500/30 bg-amber-500/5 px-4 py-3"
            >
              <div>
                <p className="font-medium">{r.academy?.name}</p>
                <p className="text-xs text-amber-400">
                  {JOIN_STATUS_LABEL[r.status]} — o coach ainda não respondeu
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-white/50"
                onClick={() => void cancel(r.id)}
              >
                Cancelar
              </Button>
            </div>
          ))}
          {rejected.length > 0 && athletes.length === 0 && pending.length === 0 && (
            <div className="border border-white/10 px-4 py-3 text-sm text-white/45">
              Último pedido rejeitado.{" "}
              <Link to="/join-academy" className="text-primary hover:underline">
                Pedir outra vez
              </Link>
            </div>
          )}
          {athletes.length === 0 && pending.length === 0 && rejected.length === 0 && (
            <p className="text-sm text-white/40">
              Ainda sem academia.{" "}
              <Link to="/join-academy" className="text-primary hover:underline">
                Envia um pedido
              </Link>
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Staff</h2>
          {academies.map((a) => (
            <Link
              key={a.id}
              to="/a/$slug/athletes"
              params={{ slug: a.slug }}
              className="flex items-center gap-3 border border-white/10 bg-[#141416] px-4 py-3 hover:border-primary/40"
            >
              <Building2 className="h-5 w-5 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-white/40">Pedidos de alunos · /{a.slug}</p>
              </div>
            </Link>
          ))}
          {academies.length === 0 && (
            <p className="text-sm text-white/40">Ainda não geres nenhuma academia.</p>
          )}
        </section>
      </div>
    </AppChrome>
  );
}
