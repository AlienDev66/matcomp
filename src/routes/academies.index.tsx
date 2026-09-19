import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAcademyCommunityStats,
  type AcademyCommunityStats,
} from "@/lib/competition/api";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { Building2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/academies/")({
  head: () => ({
    meta: [
      { title: "Academies Community — MatComp" },
      {
        name: "description",
        content: "Descobre academias de Jiu-Jitsu, rankings e contactos — sem login.",
      },
    ],
  }),
  component: AcademiesCommunityPage,
});

function AcademiesCommunityPage() {
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [applied, setApplied] = useState({ search: "", country: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["academy-community"],
    queryFn: fetchAcademyCommunityStats,
  });

  const filtered = useMemo(() => {
    const q = applied.search.trim().toLowerCase();
    const c = applied.country.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.academy.name} ${r.academy.city ?? ""} ${r.academy.slug}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (c) {
        const loc = `${r.academy.country ?? ""} ${r.academy.city ?? ""}`.toLowerCase();
        if (!loc.includes(c)) return false;
      }
      return true;
    });
  }, [rows, applied]);

  const largest = useMemo(
    () => [...filtered].sort((a, b) => b.athleteCount - a.athleteCount).slice(0, 8),
    [filtered],
  );
  const mostGold = useMemo(
    () => [...filtered].sort((a, b) => b.gold - a.gold || b.wins - a.wins).slice(0, 8),
    [filtered],
  );
  const bestDiff = useMemo(
    () => [...filtered].sort((a, b) => b.winDiff - a.winDiff || b.wins - a.wins).slice(0, 8),
    [filtered],
  );

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.academy.country) set.add(r.academy.country);
      else if (r.academy.city) set.add(r.academy.city);
    }
    return [...set].sort();
  }, [rows]);

  return (
    <div className="min-h-dvh bg-[#0a0a0b] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0b]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <Logo className="h-8 w-8" />
              <span className="font-display text-sm font-bold tracking-[0.16em] uppercase">
                MatComp
              </span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4 text-sm text-white/55">
              <Link to="/events" className="hover:text-white">
                Events
              </Link>
              <Link to="/academies" className="text-white font-medium">
                Community
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {session ? (
              <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                <Link to="/home">Área pessoal</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                  <Link to="/auth">Log in</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  className="bg-white/10 text-white hover:bg-white/15"
                >
                  <Link to="/auth">Create account</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 50% 0%, rgba(225,29,72,0.35), transparent 55%), linear-gradient(180deg, #1a0a0c 0%, #0a0a0b 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-12deg, transparent, transparent 14px, rgba(255,255,255,0.5) 14px, rgba(255,255,255,0.5) 15px)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-16 space-y-8">
          <h1 className="text-center font-display text-3xl md:text-5xl font-bold uppercase tracking-wide">
            Academies <span className="text-primary">Community</span>
          </h1>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="grid flex-1 gap-2 sm:grid-cols-3">
              <div className="relative sm:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="h-11 border-white/15 bg-black/40 pl-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setApplied({ search, country });
                  }}
                />
              </div>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="h-11 rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white/80"
              >
                <option value="">Select country</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                className="h-11 bg-primary hover:bg-primary/90"
                onClick={() => setApplied({ search, country })}
              >
                Filter
              </Button>
            </div>
            <Button
              asChild
              className="h-11 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Link to={session ? "/onboarding" : "/auth"}>
                <Plus className="mr-2 h-4 w-4" />
                Create new academy
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-12 space-y-8">
        <h2 className="text-center font-display text-xl md:text-2xl font-bold uppercase tracking-wide">
          Top academies <span className="text-white/50">last season</span>
        </h2>

        {isLoading && <p className="text-center text-sm text-white/40">A carregar…</p>}

        {!isLoading && filtered.length === 0 && (
          <p className="border border-dashed border-white/15 py-16 text-center text-sm text-white/40">
            Ainda sem academias neste filtro.
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <LeaderboardColumn title="Largest academy" rows={largest} metric="athletes" />
          <LeaderboardColumn title="Most gold medals" rows={mostGold} metric="gold" />
          <LeaderboardColumn title="Best win/loss difference" rows={bestDiff} metric="diff" />
        </div>

        <section className="space-y-4 pt-6">
          <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white/70">
            All academies
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <li key={r.academy.id}>
                <Link
                  to="/academies/$slug"
                  params={{ slug: r.academy.slug }}
                  className="flex items-center gap-3 border border-white/10 bg-white/[0.03] px-4 py-3 hover:border-primary/40 transition"
                >
                  <AcademyAvatar academy={r.academy} />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.academy.name}</p>
                    <p className="text-xs text-white/40 truncate">
                      {[r.academy.city, r.academy.country].filter(Boolean).join(", ") || "—"}
                      {" · "}
                      {r.athleteCount} athletes
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

function LeaderboardColumn({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: AcademyCommunityStats[];
  metric: "athletes" | "gold" | "diff";
}) {
  return (
    <div className="border border-white/10 bg-[#121214]">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
          {title}
        </h3>
      </div>
      <ul className="divide-y divide-white/8">
        {rows.map((r) => (
          <li key={r.academy.id}>
            <Link
              to="/academies/$slug"
              params={{ slug: r.academy.slug }}
              className="flex items-start gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition"
            >
              <AcademyAvatar academy={r.academy} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{r.academy.name}</p>
                  {metric !== "athletes" && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                        metric === "gold" && "text-amber-300",
                      )}
                    >
                      {metric === "gold" ? r.gold : r.winDiff}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40 mt-0.5">
                  {r.wins} wins / {r.losses} losses
                </p>
                <p className="text-xs text-white/35 mt-0.5">{r.athleteCount} Athletes</p>
              </div>
            </Link>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-4 py-8 text-center text-xs text-white/30">Sem dados</li>
        )}
      </ul>
    </div>
  );
}

function AcademyAvatar({ academy }: { academy: AcademyCommunityStats["academy"] }) {
  if (academy.logo_url) {
    return (
      <img
        src={academy.logo_url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover border border-white/10"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 border border-white/10">
      <Building2 className="h-4 w-4 text-white/40" />
    </div>
  );
}
