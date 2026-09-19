export type MemberRole = "owner" | "admin" | "staff";
export type CompetitionStatus = "draft" | "registration" | "live" | "finished";
export type MatchStatus = "queued" | "live" | "finished" | "cancelled";
export type AthleteCategory = "adult" | "child";

export type Academy = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  primary_color: string | null;
};

export type AcademyMember = {
  id: string;
  academy_id: string;
  user_id: string;
  role: MemberRole;
};

export type Athlete = {
  id: string;
  academy_id: string;
  full_name: string;
  belt: string | null;
  belt_degrees: number;
  category: AthleteCategory;
  weight_kg: number | null;
  birth_date: string | null;
  active: boolean;
};

export type Competition = {
  id: string;
  academy_id: string;
  name: string;
  slug: string;
  status: CompetitionStatus;
  venue: string | null;
  starts_at: string | null;
  ends_at: string | null;
  notes: string | null;
};

export type CompetitionDivision = {
  id: string;
  competition_id: string;
  name: string;
  belt: string | null;
  category: AthleteCategory | null;
  weight_min_kg: number | null;
  weight_max_kg: number | null;
  sort_order: number;
};

export type CompetitionEntry = {
  id: string;
  competition_id: string;
  division_id: string | null;
  athlete_id: string;
  seed: number | null;
  athlete?: Athlete | null;
};

export type CompetitionMatch = {
  id: string;
  competition_id: string;
  division_id: string | null;
  mat_number: number;
  sort_order: number;
  status: MatchStatus;
  athlete_a_id: string | null;
  athlete_b_id: string | null;
  score_a: number;
  score_b: number;
  winner_id: string | null;
  round_index: number;
  match_index: number;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
  athlete_a?: Athlete | null;
  athlete_b?: Athlete | null;
};

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export const STATUS_LABEL: Record<CompetitionStatus, string> = {
  draft: "Rascunho",
  registration: "Inscrições",
  live: "Ao vivo",
  finished: "Terminado",
};
