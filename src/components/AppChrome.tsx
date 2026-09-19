import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";

export function AppChrome({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = [
    { to: "/home", label: "Início", match: (p: string) => p === "/home" },
    { to: "/events", label: "Eventos", match: (p: string) => p.startsWith("/events") },
    { to: "/rankings", label: "Ranking", match: (p: string) => p.startsWith("/rankings") },
    {
      to: "/membership",
      label: "Adesão",
      match: (p: string) =>
        p.startsWith("/membership") ||
        p.startsWith("/join-academy") ||
        p.startsWith("/onboarding") ||
        p.startsWith("/a/") ||
        p.startsWith("/payments"),
    },
  ] as const;

  return (
    <div className="min-h-dvh bg-[#0a0a0b] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0b]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/home" className="flex items-center gap-2.5 min-w-0">
            <Logo className="h-8 w-8 shrink-0" />
            <span className="font-display text-sm font-bold tracking-[0.18em] uppercase truncate">
              {title ?? "MatComp"}
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-xs uppercase tracking-wider">
            {nav.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-lg px-3 py-2 transition-colors",
                    active ? "text-white" : "text-white/45 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <span className="hidden sm:inline text-white/35 px-2 truncate max-w-[120px]">
              {user?.email?.split("@")[0]}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/50 hover:text-white hover:bg-white/10"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/" });
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
