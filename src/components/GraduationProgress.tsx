import { Award, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BeltBadge } from "@/components/BeltBadge";
import {
  daysSince,
  formatDuration,
  formatRank,
  suggestNextRank,
  type BjjBelt,
  type StudentCategory,
} from "@/lib/belts";

export function GraduationProgress({
  belt,
  degrees,
  category,
  joinDate,
  lastPromotedAt,
  showLink,
}: {
  belt: BjjBelt | string;
  degrees: number;
  category: StudentCategory;
  joinDate?: string | null;
  lastPromotedAt?: string | null;
  showLink?: boolean;
}) {
  const daysInRank = daysSince(lastPromotedAt ?? joinDate);
  const next = suggestNextRank(belt as BjjBelt, degrees, category);

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-accent" />
          <span className="font-display font-semibold text-sm">Progresso de graduação</span>
        </div>
        <BeltBadge belt={belt} degrees={degrees} category={category} size="sm" />
      </div>
      <p className="text-sm">
        Graduação atual: <span className="font-medium">{formatRank(belt, degrees, category)}</span>
      </p>
      {daysInRank != null && (
        <p className="text-sm text-muted-foreground">
          Há <span className="text-foreground font-medium">{formatDuration(daysInRank)}</span> nesta graduação
        </p>
      )}
      {next ? (
        <p className="text-xs text-muted-foreground">
          Próximo passo: <span className="text-accent">{next.label}</span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Máximo de graus nesta faixa.</p>
      )}
      {showLink && (
        <Link to="/profile" className="inline-flex items-center text-xs text-accent hover:underline">
          Ver histórico completo <ChevronRight className="h-3 w-3 ml-0.5" />
        </Link>
      )}
    </div>
  );
}
