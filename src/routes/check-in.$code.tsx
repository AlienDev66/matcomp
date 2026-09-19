import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/check-in/$code")({
  head: () => ({ meta: [{ title: "Check-in QR — MatComp" }] }),
  component: CheckInQrPage,
});

function CheckInQrPage() {
  const { code } = Route.useParams();
  const normalized = code.trim().toUpperCase();
  const origin = typeof window !== "undefined" ? window.location.origin : "https://matcomp.app";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
    `${origin}/check-in/scan?code=${normalized}`,
  )}`;

  const { data: entry } = useQuery({
    queryKey: ["entry-by-code", normalized],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_entries")
        .select("*, athlete:athletes(full_name), competitions(name)")
        .eq("check_in_code", normalized)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-dvh bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-white/40">Check-in</p>
        <h1 className="font-display text-2xl font-bold">
          {(entry as any)?.competitions?.name ?? "Evento"}
        </h1>
        <p className="text-white/55">{(entry as any)?.athlete?.full_name ?? "Atleta"}</p>
      </div>
      <div className="rounded-2xl bg-white p-4">
        <img src={qrUrl} alt={`QR ${normalized}`} width={280} height={280} />
      </div>
      <p className="font-mono text-lg tracking-[0.35em]">{normalized}</p>
      {(entry as any)?.checked_in_at && (
        <p className="text-emerald-400 text-sm">Já fez check-in</p>
      )}
      <div className="flex gap-2">
        <Button asChild variant="outline" className="border-white/15">
          <Link to="/check-in/scan" search={{ code: normalized }}>
            Abrir scanner
          </Link>
        </Button>
        <Button asChild className="bg-sky-500 hover:bg-sky-400">
          <Link to="/payments">As minhas inscrições</Link>
        </Button>
      </div>
    </div>
  );
}
