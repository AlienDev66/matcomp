import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { checkInByCode } from "@/lib/competition/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/check-in/scan")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  head: () => ({ meta: [{ title: "Scanner check-in — MatComp" }] }),
  component: CheckInScanPage,
});

function CheckInScanPage() {
  const search = Route.useSearch();
  const [code, setCode] = useState(search.code ?? "");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setResult(null);
    try {
      const entry = await checkInByCode(code);
      setResult(
        `Check-in OK — ${(entry as any).athlete?.full_name ?? "atleta"} (${entry.check_in_code})`,
      );
      toast.success("Check-in registado");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-6 gap-6 max-w-md mx-auto">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-white/40">Staff</p>
        <h1 className="font-display text-3xl font-bold">QR / código check-in</h1>
        <p className="text-sm text-white/45">
          Escaneia o QR do atleta ou introduz o código manualmente.
        </p>
      </div>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="CÓDIGO"
        className="h-14 text-center font-mono text-xl tracking-widest border-white/15 bg-[#141416]"
      />
      <Button
        className="w-full h-12 bg-sky-500 hover:bg-sky-400"
        disabled={busy || !code.trim()}
        onClick={() => void submit()}
      >
        Confirmar check-in
      </Button>
      {result && <p className="text-emerald-400 text-sm text-center">{result}</p>}
      <Link to="/home" className="text-sm text-white/40 hover:text-white">
        ← Voltar
      </Link>
    </div>
  );
}
