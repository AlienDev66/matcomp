import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut, Trophy, Users, LayoutDashboard } from "lucide-react";
import type { Academy } from "@/lib/competition/types";
import { fetchAcademyJoinRequests } from "@/lib/competition/api";

export function AcademyShell({
  academy,
  children,
}: {
  academy: Academy;
  children: React.ReactNode;
}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/a/${academy.slug}`;
  const { data: pending = [] } = useQuery({
    queryKey: ["academy-join-requests", academy.id],
    queryFn: () => fetchAcademyJoinRequests(academy.id),
  });

  const nav = [
    { to: base, label: "Painel", icon: LayoutDashboard, exact: true as const },
    { to: `${base}/competitions`, label: "Competições", icon: Trophy, exact: false as const },
    {
      to: `${base}/athletes`,
      label: "Atletas",
      icon: Users,
      exact: false as const,
      badge: pending.length > 0 ? pending.length : 0,
    },
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/home" className="flex items-center gap-2.5 min-w-0">
            <Logo className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold tracking-tight leading-none truncate">
                {academy.name}
              </p>
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">MatComp</p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => {
              const active = item.exact
                ? pathname === item.to
                : pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {item.badge > 0 && (
                    <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-black">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/" });
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <nav className="md:hidden flex gap-1 overflow-x-auto px-4 pb-3">
          {nav.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                  active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
                {item.badge > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-black">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
