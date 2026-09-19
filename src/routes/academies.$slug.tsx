import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchAcademyBySlug,
  fetchAcademyPublicStaff,
  fetchAthletes,
  fetchAcademyCommunityStats,
} from "@/lib/competition/api";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Building2, MapPin, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/academies/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `${params.slug} — Academia MatComp` }],
  }),
  component: PublicAcademyProfilePage,
});

type Tab = "home" | "statistics";

function PublicAcademyProfilePage() {
  const { slug } = Route.useParams();
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("home");

  const { data: academy, isLoading } = useQuery({
    queryKey: ["public-academy", slug],
    queryFn: () => fetchAcademyBySlug(slug),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["academy-public-staff", academy?.id],
    queryFn: () => fetchAcademyPublicStaff(academy!.id),
    enabled: !!academy,
  });
  const { data: athletes = [] } = useQuery({
    queryKey: ["public-academy-athletes", academy?.id],
    queryFn: () => fetchAthletes(academy!.id),
    enabled: !!academy,
  });
  const { data: community = [] } = useQuery({
    queryKey: ["academy-community"],
    queryFn: fetchAcademyCommunityStats,
    enabled: !!academy,
  });

  const stats = community.find((c) => c.academy.id === academy?.id);
  const owner = staff.find((s) => s.role === "owner") ?? staff[0];

  if (isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#0a0a0b] text-white/40">A carregar…</div>
    );
  }

  if (!academy) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#0a0a0b] text-white p-6 text-center">
        <div>
          <p className="font-display text-2xl font-bold mb-2">Academia não encontrada</p>
          <Link to="/academies" className="text-primary hover:underline">
            Academies Community
          </Link>
        </div>
      </div>
    );
  }

  const location =
    [academy.city, academy.country].filter(Boolean).join(", ") || "Localização por definir";

  return (
    <div className="min-h-dvh bg-[#0a0a0b] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0b]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="font-display text-sm font-bold tracking-[0.16em] uppercase">
              MatComp
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost" className="text-white/60 hover:text-white">
              <Link to="/academies">Community</Link>
            </Button>
            {session ? (
              <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                <Link to="/home">Área pessoal</Link>
              </Button>
            ) : (
              <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                <Link to="/auth">Log in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Banner */}
      <section className="relative h-44 md:h-56 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: academy.primary_color
              ? `linear-gradient(135deg, ${academy.primary_color}99, #0a0a0b 70%)`
              : "radial-gradient(ellipse 80% 100% at 30% 0%, rgba(225,29,72,0.45), transparent 55%), linear-gradient(180deg, #1a0a0c, #0a0a0b)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-18deg, transparent, transparent 20px, rgba(255,255,255,0.5) 20px, rgba(255,255,255,0.5) 21px)",
          }}
        />
      </section>

      <div className="mx-auto max-w-6xl px-4">
        <div className="relative -mt-14 mb-8 flex flex-wrap items-end gap-4">
          {academy.logo_url ? (
            <img
              src={academy.logo_url}
              alt=""
              className="h-24 w-24 md:h-28 md:w-28 rounded-full object-cover border-4 border-[#0a0a0b] bg-[#121214]"
            />
          ) : (
            <div className="flex h-24 w-24 md:h-28 md:w-28 items-center justify-center rounded-full border-4 border-[#0a0a0b] bg-[#121214]">
              <Building2 className="h-10 w-10 text-white/30" />
            </div>
          )}
          <div className="pb-2">
            <h1 className="font-display text-2xl md:text-4xl font-bold uppercase tracking-wide">
              {academy.name}
            </h1>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[220px_1fr] pb-16">
          {/* Sidebar */}
          <aside className="space-y-6">
            <div className="space-y-2 text-sm text-white/55">
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {location}
              </p>
              {stats && (
                <p className="flex flex-wrap items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] text-amber-200 tabular-nums">
                    {stats.gold}🥇
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] tabular-nums">
                    {stats.wins}W
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] tabular-nums">
                    {stats.losses}L
                  </span>
                </p>
              )}
            </div>

            <nav className="space-y-1">
              {(
                [
                  { id: "home" as const, label: "Home" },
                  { id: "statistics" as const, label: "Statistics" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm transition",
                    tab === item.id
                      ? "bg-white/10 text-white font-medium"
                      : "text-white/45 hover:text-white hover:bg-white/[0.04]",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {session && (
              <Button asChild variant="outline" size="sm" className="w-full border-white/15">
                <Link to="/join-academy">Pedir adesão</Link>
              </Button>
            )}
            {!session && (
              <Button asChild size="sm" className="w-full bg-primary hover:bg-primary/90">
                <Link to="/auth">Entrar para aderir</Link>
              </Button>
            )}
          </aside>

          {/* Main */}
          <div className="space-y-6 min-w-0">
            {tab === "home" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 border border-white/10 bg-[#121214] p-5">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/40">Location</p>
                    <p className="mt-1 font-medium">{location}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/40">
                      Person in charge
                    </p>
                    <p className="mt-1 font-medium">{owner?.full_name ?? "—"}</p>
                  </div>
                </div>

                <section className="border border-white/10 bg-[#121214]">
                  <div className="border-b border-white/10 px-5 py-3">
                    <h2 className="text-sm font-semibold">Contact Persons</h2>
                  </div>
                  <ul className="divide-y divide-white/8">
                    {staff.map((s) => (
                      <li
                        key={s.user_id}
                        className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
                      >
                        <span className="font-medium uppercase tracking-wide text-sm">
                          {s.full_name}
                        </span>
                        <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                          {s.role === "owner" ? "Admin" : s.role}
                        </span>
                      </li>
                    ))}
                    {staff.length === 0 && (
                      <li className="px-5 py-8 text-sm text-white/35 text-center">
                        Sem contactos públicos.
                      </li>
                    )}
                  </ul>
                </section>

                {academy.affiliation && (
                  <section className="space-y-3">
                    <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                      Affiliations
                    </h2>
                    <div className="flex items-center gap-3 border border-white/10 bg-[#121214] px-4 py-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-white/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <p className="font-medium">{academy.affiliation}</p>
                    </div>
                  </section>
                )}
              </>
            )}

            {tab === "statistics" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Athletes", value: athletes.length },
                    { label: "Wins", value: stats?.wins ?? 0 },
                    { label: "Gold", value: stats?.gold ?? 0 },
                  ].map((s) => (
                    <div key={s.label} className="border border-white/10 bg-[#121214] p-5">
                      <p className="text-xs uppercase tracking-wider text-white/40">{s.label}</p>
                      <p className="mt-1 font-display text-3xl font-bold tabular-nums">{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="border border-white/10 bg-[#121214] p-5 text-sm text-white/50">
                  {stats
                    ? `${stats.wins} wins / ${stats.losses} losses · diff ${stats.winDiff}`
                    : "Sem resultados de ranking ainda."}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
