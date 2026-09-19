import { Megaphone, Pin } from "lucide-react";
import type { Announcement } from "@/lib/announcements";

export function AnnouncementsFeed({ items }: { items: Announcement[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Megaphone className="h-3.5 w-3.5" />
        Avisos da academia
      </div>
      {items.map((a) => (
        <div
          key={a.id}
          className="rounded-lg border border-border bg-card/50 p-4"
        >
          <div className="flex items-start gap-2">
            {a.pinned && <Pin className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />}
            <div>
              <p className="font-display font-semibold text-sm">{a.title}</p>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
