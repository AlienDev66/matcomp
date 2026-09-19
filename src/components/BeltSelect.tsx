import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BeltBadge } from "@/components/BeltBadge";
import { beltsForCategory, type BjjBelt, type StudentCategory } from "@/lib/belts";

type Props = {
  category: StudentCategory;
  value: BjjBelt;
  onValueChange: (belt: BjjBelt) => void;
};

export function BeltSelect({ category, value, onValueChange }: Props) {
  const options = beltsForCategory(category);

  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as BjjBelt)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((belt) => (
          <SelectItem key={belt} value={belt}>
            <BeltBadge belt={belt} size="xs" />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
