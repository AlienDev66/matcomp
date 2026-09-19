import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchOrganizerEvents,
  fetchPublicOrganizerBySlug,
} from "@/lib/competition/organizers";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL } from "@/lib/competition/types";
import { Globe, Mail, MapPin } from "lucide-react";

export const Route = createFileRoute("/o/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `${params.slug} — Organizador MatComp` }],
  }),
  component: PublicOrganizerPage,
});

function PublicOrganizerPage() {
  const { slug } = Route.useParams();
  const { data: org, isLoading } = useQuery({
    queryKey: ["public-org", slug],
    queryFn: () => fetchPublicOrganizerBySlug(slug),
  });
  const { data: events = [] } = useQuery({
    queryKey: ["public-org-events", org?.id],
    queryFn: () => fetchOrganizerEvents(org!.id),
    enabled: !!org,
  });

  const publicEvents = events.filter(
    (e: any) => e.status === "registration" || e.status === "live" || e.status === "finished",
  );

  if (isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#0a0a0b] text-white/40">A carregar…</div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#0a0a0b] text-white p-6 text-center">
        <div>
          <p className="font-display text-2xl font-bold mb-2">Organização não encontrada</p>
          <Link to="/" className="text-primary hover:underline">
            MatComp
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0a0a0b] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="text-xs uppercase tracking-widest text-white/40">MatComp</span>
          </Link>
          <Button asChild size="sm" variant="outline" className="border-white/15">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 80% 0%, rgba(225,29,72,0.35), transparent 55%), #0e0a0c",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 py-14 md:py-20">
          <p className="text-[10px] uppercase tracking-[0.28em] text-primary">Organizador</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold">{org.name}</h1>
          {org.country && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-white/50">
              <MapPin className="h-3.5 w-3.5" />
              {org.country}
            </p>
          )}
          {org.description && (
            <p className="mt-5 max-w-2xl text-white/60 leading-relaxed">{org.description}</p>
          )}
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            {org.website_url && (
              <a
                href={org.website_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Globe className="h-4 w-4" /> Website
              </a>
            )}
            {org.contact_email && (
              <a
                href={`mailto:${org.contact_email}`}
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Mail className="h-4 w-4" /> Contacto
              </a>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4 py-12 space-y-6">
        <h2 className="font-display text-2xl font-bold">Eventos</h2>
        <ul className="space-y-2">
          {publicEvents.map((ev: any) => (
            <li key={ev.id}>
              <Link
                to="/$lang/event/$eventId"
                params={{ lang: "pt", eventId: ev.id }}
                className="flex flex-wrap items-center justify-between gap-3 border border-white/10 px-5 py-4 hover:border-primary/40 transition"
              >
                <div>
                  <p className="font-display font-semibold">{ev.name}</p>
                  <p className="text-xs text-white/40 mt-1">
                    {ev.venue ?? "Local a anunciar"}
                    {ev.starts_at
                      ? ` · ${new Date(ev.starts_at).toLocaleDateString("pt-PT")}`
                      : ""}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-wider text-primary">
                  {STATUS_LABEL[ev.status as keyof typeof STATUS_LABEL] ?? ev.status}
                </span>
              </Link>
            </li>
          ))}
          {publicEvents.length === 0 && (
            <li className="py-12 text-center text-white/35 text-sm">Sem eventos públicos ainda</li>
          )}
        </ul>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-white/30">
        Organização na plataforma MatComp
      </footer>
    </div>
  );
}
