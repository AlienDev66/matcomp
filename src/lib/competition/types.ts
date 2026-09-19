export type MemberRole = "owner" | "admin" | "staff";
export type CompetitionStatus = "draft" | "registration" | "live" | "finished";
export type MatchStatus = "queued" | "live" | "finished" | "cancelled";
export type AthleteCategory = "adult" | "child";
export type JoinRequestStatus = "pending" | "accepted" | "rejected";
export type InfoLang = "pt" | "en" | "es";

export type Academy = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  primary_color: string | null;
  require_member_approval?: boolean;
  affiliation?: string | null;
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
  user_id: string | null;
  full_name: string;
  belt: string | null;
  belt_degrees: number;
  category: AthleteCategory;
  weight_kg: number | null;
  birth_date: string | null;
  active: boolean;
  country_code?: string | null;
  affiliation?: string | null;
  academy?: Pick<Academy, "id" | "name" | "slug" | "city" | "affiliation"> | null;
};

export type AcademyJoinRequest = {
  id: string;
  user_id: string;
  academy_id: string;
  status: JoinRequestStatus;
  message: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  academy?: Academy | null;
  profile?: { full_name: string; email: string | null } | null;
};

export type Competition = {
  id: string;
  academy_id: string | null;
  created_by: string | null;
  federation_id?: string | null;
  name: string;
  slug: string;
  status: CompetitionStatus;
  venue: string | null;
  starts_at: string | null;
  ends_at: string | null;
  notes: string | null;
  cover_image_url?: string | null;
  contact_email?: string | null;
  livestream_url?: string | null;
  refund_policy_url?: string | null;
  map_query?: string | null;
  info_pt?: string | null;
  info_en?: string | null;
  info_es?: string | null;
  deadline_early_at?: string | null;
  deadline_refund_100_at?: string | null;
  deadline_edit_at?: string | null;
  organizer_years?: number | null;
  organizer_events_count?: number | null;
  mats_count?: number;
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
  price_cents?: number;
  currency?: string;
  parent_id?: string | null;
  kind?: "group" | "entry";
  gender?: "male" | "female" | "open" | null;
  age_label?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  weight_label?: string | null;
};

export type UserProfile = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone?: string | null;
  nationality?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  avatar_url?: string | null;
};

export type CompetitionEntry = {
  id: string;
  competition_id: string;
  division_id: string | null;
  athlete_id: string;
  seed: number | null;
  approved?: boolean;
  paid?: boolean;
  paid_at?: string | null;
  stripe_session_id?: string | null;
  amount_paid_cents?: number | null;
  check_in_code?: string | null;
  checked_in_at?: string | null;
  athlete?: Athlete | null;
  competitions?: Pick<Competition, "id" | "name" | "starts_at" | "cover_image_url"> | null;
};

export type Federation = {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  logo_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  primary_color: string | null;
};

export type RankingSeason = {
  id: string;
  name: string;
  slug: string;
  category_label: string;
  starts_at: string | null;
  ends_at: string | null;
  last_calculated_at: string | null;
};

export type RankingRow = {
  id: string;
  season_id: string;
  athlete_id: string;
  points: number;
  wins: number;
  losses: number;
  gold: number;
  silver: number;
  bronze: number;
  rank: number | null;
  athlete?: Athlete | null;
};

export type WinMethod =
  | "points"
  | "submission"
  | "decision"
  | "disqualification"
  | "walkover"
  | "no_show"
  | "other";

export const WIN_METHOD_LABEL: Record<WinMethod, string> = {
  points: "Pontos",
  submission: "Finalização",
  decision: "Decisão",
  disqualification: "Desqualificação",
  walkover: "Walkover",
  no_show: "Não compareceu",
  other: "Outro",
};

/** Labels curtas para botões da mesa */
export const WIN_METHOD_BTN: Record<WinMethod, string> = {
  points: "PONTOS",
  submission: "FINALIZAÇÃO",
  decision: "DECISÃO",
  disqualification: "DQ",
  walkover: "WO",
  no_show: "NO SHOW",
  other: "OUTRO",
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
  advantages_a?: number;
  advantages_b?: number;
  penalties_a?: number;
  penalties_b?: number;
  winner_id: string | null;
  win_method?: WinMethod | null;
  round_index: number;
  match_index: number;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
  estimated_start?: string | null;
  clock_seconds?: number;
  clock_running?: boolean;
  clock_updated_at?: string | null;
  sides_swapped?: boolean;
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

export const JOIN_STATUS_LABEL: Record<JoinRequestStatus, string> = {
  pending: "Pendente",
  accepted: "Aceite",
  rejected: "Rejeitado",
};

export function formatPrice(cents: number | null | undefined, currency = "EUR") {
  const value = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function flagEmoji(countryCode: string | null | undefined) {
  if (!countryCode || countryCode.length !== 2) return null;
  const cc = countryCode.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
}

export function deadlineStatus(iso: string | null | undefined, now = new Date()) {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const passed = at.getTime() < now.getTime();
  return {
    passed,
    label: passed ? "Passed" : "Open",
    at,
    display: `${passed ? "Passed" : "Open"} (${iso.replace("T", " ").slice(0, 16)})`,
  };
}
