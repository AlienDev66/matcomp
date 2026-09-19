import { createFileRoute } from "@tanstack/react-router";
import { AppChrome } from "@/components/AppChrome";
import { EventDiscovery } from "@/components/EventDiscovery";

export const Route = createFileRoute("/_authenticated/events/")({
  head: () => ({ meta: [{ title: "Eventos — MatComp" }] }),
  component: EventsMarketplacePage,
});

function EventsMarketplacePage() {
  return (
    <AppChrome title="Eventos">
      <EventDiscovery />
    </AppChrome>
  );
}
