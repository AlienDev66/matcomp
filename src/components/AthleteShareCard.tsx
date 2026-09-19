import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStudentPhotoUrl } from "@/lib/student-photo";
import {
  beltGradient,
  daysSince,
  formatDuration,
  formatRank,
  getBeltConfig,
  type BjjBelt,
  type StudentCategory,
} from "@/lib/belts";
import { toast } from "sonner";

type CardProfile = {
  full_name: string;
  belt: BjjBelt | string;
  belt_degrees: number;
  category: StudentCategory;
  join_date?: string | null;
  photo_path?: string | null;
};

export function AthleteShareCard({ profile }: { profile: CardProfile }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const { data: photoUrl } = useQuery({
    queryKey: ["card-photo", profile.photo_path],
    queryFn: () => getStudentPhotoUrl(profile.photo_path),
    enabled: !!profile.photo_path,
  });

  const beltCfg = getBeltConfig(profile.belt);
  const tenure = formatDuration(daysSince(profile.join_date));
  const tenureMatch = tenure.match(/^(\d+(?:a\s+\d+m)?)\s+(.+)$/);
  const tenureValue = tenureMatch?.[1] ?? tenure;
  const tenureUnit = tenureMatch?.[2] ?? "";
  const rank = formatRank(profile.belt, profile.belt_degrees, profile.category);
  const initials = profile.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const exportCard = async () => {
    if (!cardRef.current) return null;
    return toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#07060f",
    });
  };

  const download = async () => {
    setBusy(true);
    try {
      const dataUrl = await exportCard();
      if (!dataUrl) return;
      const link = document.createElement("a");
      link.download = `teamfs-${profile.full_name.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Cartão guardado.");
    } catch {
      toast.error("Não foi possível gerar a imagem.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const dataUrl = await exportCard();
      if (!dataUrl) return;
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "teamfs-cartao.png", { type: "image/png" });
      const text = `🥋 ${profile.full_name} · ${rank} · Team FS BJJ`;

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Cartão Team FS BJJ", text });
        toast.success("Partilhado!");
      } else {
        const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(wa, "_blank", "noopener,noreferrer");
        await download();
        toast.success("Abre o WhatsApp e envia a imagem que acabou de descarregar.");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        toast.error("Não foi possível partilhar.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center overflow-x-auto pb-2">
        <div
          ref={cardRef}
          className="relative w-[min(100%,320px)] aspect-[9/16] rounded-2xl overflow-hidden text-white shadow-2xl"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 35%, rgba(124,58,237,0.35) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(20,184,166,0.25) 0%, transparent 55%), linear-gradient(165deg, #0a0814 0%, #120f22 45%, #07060f 100%)",
          }}
        >
          {/* stars */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(1px 1px at 20% 30%, white, transparent), radial-gradient(1px 1px at 60% 70%, white, transparent), radial-gradient(1px 1px at 80% 20%, white, transparent), radial-gradient(1px 1px at 40% 80%, white, transparent)",
            }}
          />

          {/* frame */}
          <div className="absolute inset-3 border border-white/20 rounded-xl pointer-events-none" />

          {/* left bar */}
          <div
            className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center"
            style={{ background: "linear-gradient(180deg, #7c3aed 0%, #ec4899 100%)" }}
          >
            <span
              className="text-[9px] font-bold tracking-[0.2em] whitespace-nowrap"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              // TEAM FS BJJ //
            </span>
          </div>

          {/* right bar */}
          <div
            className="absolute right-0 top-0 bottom-0 w-8 flex flex-col items-center justify-center gap-2 px-1"
            style={{ background: "linear-gradient(180deg, #14b8a6 0%, #22c55e 100%)" }}
          >
            <span
              className="text-[8px] font-bold tracking-wider text-center leading-tight"
              style={{ writingMode: "vertical-rl" }}
            >
              {beltCfg.label.toUpperCase()}
            </span>
          </div>

          {/* content */}
          <div className="absolute inset-8 flex flex-col items-center text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 mt-1">Atleta</p>

            <div className="relative mt-4 mb-3">
              <div
                className="absolute -inset-3 rounded-full blur-xl opacity-60"
                style={{ background: beltGradient(profile.belt) }}
              />
              <div className="relative w-28 h-28 rounded-full border-2 border-white/30 overflow-hidden bg-black/40 flex items-center justify-center">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <span className="text-3xl font-display font-bold text-white/90">{initials}</span>
                )}
              </div>
            </div>

            <p className="text-4xl font-display font-black leading-none tracking-tight">
              {tenure === "—" ? "—" : tenureValue}
              {tenureUnit && (
                <span className="text-lg font-semibold text-white/70 ml-1">{tenureUnit}</span>
              )}
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 mt-1">na academia</p>

            <div className="mt-5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm w-full">
              <p className="text-sm font-semibold">{rank}</p>
              <p className="text-[10px] text-white/50 mt-0.5">
                {profile.category === "child" ? "Categoria infantil" : "Categoria adulto"}
              </p>
            </div>

            <div className="mt-auto w-full pt-4">
              <p className="text-lg font-display font-bold leading-tight">{profile.full_name}</p>
              <p className="text-[10px] text-white/40 mt-1 tracking-widest">TEAM FS · BRAZILIAN JIU-JITSU</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <Button onClick={share} disabled={busy} className="bg-primary hover:bg-primary/90">
          <Share2 className="h-4 w-4 mr-2" />
          {busy ? "A gerar…" : "Partilhar"}
        </Button>
        <Button onClick={download} disabled={busy} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Descarregar
        </Button>
      </div>
      <p className="text-xs text-center text-muted-foreground">
        Partilha no WhatsApp, Instagram ou guarda como imagem.
      </p>
    </div>
  );
}
