import { createFileRoute } from "@tanstack/react-router";
import { EventPublicView } from "@/components/EventPublicView";

const LANGS = ["pt", "en", "es"] as const;
type Lang = (typeof LANGS)[number];

export const Route = createFileRoute("/$lang/event/$eventId/")({
  component: LangEventIndexPage,
});

function LangEventIndexPage() {
  const { lang, eventId } = Route.useParams();
  const safeLang: Lang = LANGS.includes(lang as Lang) ? (lang as Lang) : "pt";
  return <EventPublicView competitionId={eventId} lang={safeLang} />;
}
