import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maxRankMarks, rankMarksLabel, type BjjBelt, type StudentCategory } from "@/lib/belts";

type Props = {
  belt: BjjBelt;
  category: StudentCategory;
  value: number;
  onChange: (value: number) => void;
};

export function DegreesInput({ belt, category, value, onChange }: Props) {
  const max = maxRankMarks(belt, category);
  if (max === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Crianças progridem por cor de faixa — sem graus.
      </p>
    );
  }

  const unit = "grau";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </Button>
        <Input
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value) || 0)))}
          className="w-20 text-center"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </Button>
        <span className="text-sm text-muted-foreground">
          {rankMarksLabel(belt, category, value) || `0 ${unit}s`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Máximo: {max} {unit}{max > 1 ? "s" : ""}</p>
    </div>
  );
}
