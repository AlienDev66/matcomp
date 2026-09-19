import type { Athlete, CompetitionDivision } from "./types";

export type DivisionKind = "group" | "entry";
export type DivisionGender = "male" | "female" | "open";

export const IBJJF_ADULT_WEIGHTS: { label: string; maxKg: number | null }[] = [
  { label: "Rooster", maxKg: 57.5 },
  { label: "Light feather", maxKg: 64 },
  { label: "Feather", maxKg: 70 },
  { label: "Light", maxKg: 76 },
  { label: "Middle", maxKg: 82.3 },
  { label: "Medium heavy", maxKg: 88.3 },
  { label: "Heavy", maxKg: 94.3 },
  { label: "Super heavy", maxKg: 100.5 },
  { label: "Ultra heavy", maxKg: null },
];

export const BJJ_BELTS = ["white", "blue", "purple", "brown", "black"] as const;

export const IBJJF_KIDS_WEIGHTS: { label: string; maxKg: number | null }[] = [
  { label: "Gallinho", maxKg: 25 },
  { label: "Leve", maxKg: 30 },
  { label: "Médio", maxKg: 35 },
  { label: "Meio-pesado", maxKg: 40 },
  { label: "Pesado", maxKg: 45 },
  { label: "Super-pesado", maxKg: null },
];

export type DivisionTemplatePreset =
  | "adult_gi"
  | "adult_nogi"
  | "master1_gi"
  | "master2_gi"
  | "master3_gi"
  | "juvenile_gi"
  | "kids_gi";

export const DIVISION_TEMPLATE_META: Record<
  DivisionTemplatePreset,
  {
    label: string;
    age_label: string;
    age_min: number;
    age_max: number | null;
    gi: boolean;
    weights: { label: string; maxKg: number | null }[];
    belts: readonly string[];
  }
> = {
  adult_gi: {
    label: "Adult Gi",
    age_label: "Adult",
    age_min: 18,
    age_max: 29,
    gi: true,
    weights: IBJJF_ADULT_WEIGHTS,
    belts: BJJ_BELTS,
  },
  adult_nogi: {
    label: "Adult No-Gi",
    age_label: "Adult",
    age_min: 18,
    age_max: 29,
    gi: false,
    weights: IBJJF_ADULT_WEIGHTS,
    belts: BJJ_BELTS,
  },
  master1_gi: {
    label: "Master 1 Gi",
    age_label: "Master 1",
    age_min: 30,
    age_max: 40,
    gi: true,
    weights: IBJJF_ADULT_WEIGHTS,
    belts: ["blue", "purple", "brown", "black"],
  },
  master2_gi: {
    label: "Master 2 Gi",
    age_label: "Master 2",
    age_min: 41,
    age_max: 50,
    gi: true,
    weights: IBJJF_ADULT_WEIGHTS,
    belts: ["blue", "purple", "brown", "black"],
  },
  master3_gi: {
    label: "Master 3 Gi",
    age_label: "Master 3",
    age_min: 51,
    age_max: null,
    gi: true,
    weights: IBJJF_ADULT_WEIGHTS,
    belts: ["purple", "brown", "black"],
  },
  juvenile_gi: {
    label: "Juvenile Gi",
    age_label: "Juvenile",
    age_min: 16,
    age_max: 17,
    gi: true,
    weights: IBJJF_ADULT_WEIGHTS,
    belts: ["white", "blue", "purple"],
  },
  kids_gi: {
    label: "Kids Gi",
    age_label: "Kids",
    age_min: 8,
    age_max: 15,
    gi: true,
    weights: IBJJF_KIDS_WEIGHTS,
    belts: ["white", "grey", "yellow", "orange", "green"],
  },
};

export function athleteAgeYears(birthDate: string | null | undefined, on = new Date()): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  let age = on.getFullYear() - d.getFullYear();
  const m = on.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < d.getDate())) age -= 1;
  return age;
}

export function eligibilityWhy(
  div: CompetitionDivision,
  athlete: Pick<Athlete, "belt" | "birth_date" | "weight_kg" | "category"> & {
    gender?: string | null;
  },
): string | null {
  const age = athleteAgeYears(athlete.birth_date);
  const gender = athlete.gender ?? null;

  if (div.gender && div.gender !== "open") {
    if (!gender) return "Define o género no perfil para esta categoria.";
    if (gender !== div.gender) return `Categoria só para ${div.gender === "male" ? "masculino" : "feminino"}.`;
  }

  if (div.age_min != null || div.age_max != null) {
    if (age == null) return "Define a data de nascimento para verificar a idade.";
    if (div.age_min != null && age < div.age_min) return `Idade mínima: ${div.age_min} anos.`;
    if (div.age_max != null && age > div.age_max) return `Idade máxima: ${div.age_max} anos.`;
  }

  if (div.belt && athlete.belt && div.belt !== athlete.belt) {
    return `Cinturão requerido: ${div.belt}.`;
  }

  if (div.weight_min_kg != null || div.weight_max_kg != null) {
    if (athlete.weight_kg == null) return "Define o peso no perfil para esta classe.";
    if (div.weight_min_kg != null && athlete.weight_kg < Number(div.weight_min_kg)) {
      return `Peso mínimo: ${div.weight_min_kg} kg.`;
    }
    if (div.weight_max_kg != null && athlete.weight_kg > Number(div.weight_max_kg)) {
      return `Peso máximo: ${div.weight_max_kg} kg.`;
    }
  }

  return null;
}

export function isDivisionEligible(
  div: CompetitionDivision,
  athlete: Pick<Athlete, "belt" | "birth_date" | "weight_kg" | "category"> & {
    gender?: string | null;
  },
) {
  return eligibilityWhy(div, athlete) == null;
}

export type DivisionGroupView = {
  group: CompetitionDivision;
  entries: CompetitionDivision[];
  eligible: boolean;
  why: string | null;
};

/** Build group → entries tree. Flat legacy entries become single-entry groups. */
export function buildDivisionTree(
  divisions: CompetitionDivision[],
  athlete?: Pick<Athlete, "belt" | "birth_date" | "weight_kg" | "category"> & {
    gender?: string | null;
  },
): DivisionGroupView[] {
  const groups = divisions.filter((d) => d.kind === "group");
  const entries = divisions.filter((d) => d.kind !== "group");

  if (groups.length > 0) {
    const fromGroups = groups
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((group) => {
        const kids = entries
          .filter((e) => e.parent_id === group.id)
          .sort((a, b) => a.sort_order - b.sort_order);
        const why = athlete ? eligibilityWhy(group, athlete) : null;
        return {
          group,
          entries: kids,
          eligible: why == null,
          why,
        };
      });
    const orphans = entries
      .filter((d) => !d.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((d) => {
        const why = athlete ? eligibilityWhy(d, athlete) : null;
        return {
          group: { ...d, kind: "group" as const },
          entries: [{ ...d, kind: "entry" as const }],
          eligible: why == null,
          why,
        };
      });
    return [...fromGroups, ...orphans];
  }

  return entries
    .filter((d) => !d.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((d) => {
      const why = athlete ? eligibilityWhy(d, athlete) : null;
      return {
        group: { ...d, kind: "group" as const },
        entries: [{ ...d, kind: "entry" as const }],
        eligible: why == null,
        why,
      };
    });
}

export function uniqueBelts(entries: CompetitionDivision[]) {
  return [...new Set(entries.map((e) => e.belt).filter(Boolean))] as string[];
}

export function uniqueAgeLabels(entries: CompetitionDivision[], belt?: string | null) {
  return [
    ...new Set(
      entries
        .filter((e) => !belt || e.belt === belt)
        .map((e) => e.age_label)
        .filter(Boolean),
    ),
  ] as string[];
}

export function weightOptions(
  entries: CompetitionDivision[],
  belt?: string | null,
  ageLabel?: string | null,
) {
  return entries.filter(
    (e) => (!belt || e.belt === belt) && (!ageLabel || e.age_label === ageLabel),
  );
}
