import { supabase } from "@/integrations/supabase/client";
import type {
  Academy,
  AcademyJoinRequest,
  Athlete,
  Competition,
  CompetitionDivision,
  CompetitionEntry,
  CompetitionMatch,
  CompetitionStatus,
  MatchStatus,
} from "./types";
import { slugify } from "./types";
import { planSingleElimination } from "./bracket";

export async function fetchMyAcademies() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [] as Academy[];

  const { data: memberships, error } = await supabase
    .from("academy_members")
    .select("academy_id, role, academies(*)")
    .eq("user_id", user.id);
  if (error) throw error;

  return (memberships ?? []).map((m: any) => m.academies as Academy).filter(Boolean);
}

export async function fetchAllAcademies() {
  const { data, error } = await supabase.from("academies").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Academy[];
}

export async function fetchAcademyBySlug(slug: string) {
  const { data, error } = await supabase.from("academies").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data as Academy | null;
}

export async function createAcademy(input: { name: string; city?: string; slug?: string }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Precisas de sessão.");

  let base = slugify(input.slug || input.name) || "academia";
  let slug = base;
  for (let i = 0; i < 8; i++) {
    const { data: existing } = await supabase.from("academies").select("id").eq("slug", slug).maybeSingle();
    if (!existing) break;
    slug = `${base}-${i + 2}`;
  }

  const { data: academy, error } = await supabase
    .from("academies")
    .insert({
      name: input.name.trim(),
      slug,
      city: input.city?.trim() || null,
    } as never)
    .select("*")
    .single();
  if (error) throw error;

  const { error: memErr } = await supabase.from("academy_members").insert({
    academy_id: academy.id,
    user_id: user.id,
    role: "owner",
  } as never);
  if (memErr) throw memErr;

  return academy as Academy;
}

export async function fetchMyAthleteMemberships() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [] as Athlete[];

  const { data, error } = await supabase
    .from("athletes")
    .select("*, academies(*)")
    .eq("user_id", user.id)
    .eq("active", true);
  if (error) throw error;
  return (data ?? []) as (Athlete & { academies?: Academy | null })[];
}

export async function fetchMyJoinRequests() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [] as AcademyJoinRequest[];

  const { data, error } = await supabase
    .from("academy_join_requests")
    .select("*, academies(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    academy: row.academies ?? null,
  })) as AcademyJoinRequest[];
}

export async function requestJoinAcademy(academyId: string, message?: string) {
  const { data, error } = await supabase.rpc("request_join_academy", {
    _academy_id: academyId,
    _message: message?.trim() || null,
  } as never);
  if (error) throw error;
  return data as AcademyJoinRequest;
}

export async function cancelJoinRequest(requestId: string) {
  const { error } = await supabase
    .from("academy_join_requests")
    .delete()
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function fetchAcademyJoinRequests(academyId: string) {
  const { data, error } = await supabase
    .from("academy_join_requests")
    .select("*")
    .eq("academy_id", academyId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as AcademyJoinRequest[];
  if (rows.length === 0) return rows;

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", userIds);

  const byUser = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
  return rows.map((r) => ({
    ...r,
    profile: byUser.get(r.user_id)
      ? { full_name: byUser.get(r.user_id)!.full_name, email: byUser.get(r.user_id)!.email }
      : null,
  }));
}

export async function acceptJoinRequest(requestId: string) {
  const { data, error } = await supabase.rpc("accept_academy_join_request", {
    _request_id: requestId,
  } as never);
  if (error) throw error;
  return data as Athlete;
}

export async function rejectJoinRequest(requestId: string) {
  const { data, error } = await supabase.rpc("reject_academy_join_request", {
    _request_id: requestId,
  } as never);
  if (error) throw error;
  return data as AcademyJoinRequest;
}

export async function fetchAthletes(academyId: string) {
  const { data, error } = await supabase
    .from("athletes")
    .select("*")
    .eq("academy_id", academyId)
    .eq("active", true)
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as Athlete[];
}

export async function createAthlete(
  academyId: string,
  input: { full_name: string; belt?: string; category?: string; weight_kg?: number | null },
) {
  throw new Error(
    "Já não é possível adicionar atletas sem conta. Usa o email da conta MatComp.",
  );
}

/** Add existing MatComp user to academy roster by email. */
export async function addAthleteByEmail(academyId: string, email: string) {
  const { data, error } = await supabase.rpc("add_athlete_by_email", {
    _academy_id: academyId,
    _email: email.trim(),
  } as never);
  if (error) throw error;
  return data as Athlete;
}

/** Soft-remove from roster (active=false, unlink account). */
export async function removeAthlete(athleteId: string) {
  const { data, error } = await supabase.rpc("remove_academy_athlete", {
    _athlete_id: athleteId,
  } as never);
  if (error) throw error;
  return data as Athlete;
}

export async function fetchCompetitions(academyId: string) {
  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .eq("academy_id", academyId)
    .order("starts_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Competition[];
}

export async function fetchEvents(filters?: {
  scope?: "all" | "upcoming" | "past" | "mine";
  search?: string;
  country?: string;
  federationId?: string | null;
}) {
  const scope = filters?.scope ?? "all";
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let q = supabase.from("competitions").select("*");

  if (scope === "mine") {
    if (!user) return [] as Competition[];
    q = q.eq("created_by", user.id);
  }

  if (filters?.federationId) {
    q = q.eq("federation_id", filters.federationId);
  }

  const { data, error } = await q.order("starts_at", { ascending: true, nullsFirst: false });
  if (error) throw error;

  const now = Date.now();
  let rows = (data ?? []) as Competition[];

  if (scope === "upcoming") {
    rows = rows.filter((e) => {
      if (e.status === "finished") return false;
      if (!e.starts_at) return e.status !== "finished";
      return new Date(e.starts_at).getTime() >= now - 12 * 3600 * 1000;
    });
  }
  if (scope === "past") {
    rows = rows.filter((e) => {
      if (e.status === "finished") return true;
      if (!e.starts_at) return false;
      return new Date(e.starts_at).getTime() < now - 12 * 3600 * 1000;
    });
  }

  const search = filters?.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (e) =>
        e.name.toLowerCase().includes(search) ||
        (e.venue ?? "").toLowerCase().includes(search) ||
        (e.map_query ?? "").toLowerCase().includes(search),
    );
  }

  return rows;
}

export async function fetchMyEvents() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [] as Competition[];

  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Competition[];
}

export async function createCompetition(
  academyId: string | null,
  input: {
    name: string;
    venue?: string;
    starts_at?: string | null;
    status?: CompetitionStatus;
    federation_id?: string | null;
  },
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Precisas de sessão.");

  const slug = slugify(input.name) || `comp-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("competitions")
    .insert({
      academy_id: academyId,
      created_by: user.id,
      federation_id: input.federation_id ?? null,
      name: input.name.trim(),
      slug,
      venue: input.venue?.trim() || null,
      starts_at: input.starts_at || null,
      status: input.status ?? "draft",
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as Competition;
}

export async function createEvent(input: {
  name: string;
  venue?: string;
  starts_at?: string | null;
  academy_id?: string | null;
  federation_id?: string | null;
  status?: CompetitionStatus;
}) {
  return createCompetition(input.academy_id ?? null, {
    name: input.name,
    venue: input.venue,
    starts_at: input.starts_at,
    status: input.status,
    federation_id: input.federation_id,
  });
}

export async function updateCompetitionStatus(competitionId: string, status: CompetitionStatus) {
  const { data, error } = await supabase
    .from("competitions")
    .update({ status } as never)
    .eq("id", competitionId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Competition;
}

export type CompetitionUpdate = Partial<{
  name: string;
  venue: string | null;
  starts_at: string | null;
  ends_at: string | null;
  notes: string | null;
  status: CompetitionStatus;
  cover_image_url: string | null;
  contact_email: string | null;
  livestream_url: string | null;
  refund_policy_url: string | null;
  map_query: string | null;
  info_pt: string | null;
  info_en: string | null;
  info_es: string | null;
  deadline_early_at: string | null;
  deadline_refund_100_at: string | null;
  deadline_edit_at: string | null;
  organizer_years: number | null;
  organizer_events_count: number | null;
  academy_id: string | null;
  federation_id: string | null;
  mats_count: number;
}>;

export async function updateCompetition(competitionId: string, patch: CompetitionUpdate) {
  const { data, error } = await supabase
    .from("competitions")
    .update(patch as never)
    .eq("id", competitionId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Competition;
}

export async function fetchCompetition(id: string) {
  const { data, error } = await supabase.from("competitions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Competition | null;
}

export async function fetchDivisions(competitionId: string) {
  const { data, error } = await supabase
    .from("competition_divisions")
    .select("*")
    .eq("competition_id", competitionId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as CompetitionDivision[];
}

export async function createDivision(
  competitionId: string,
  input:
    | string
    | {
        name: string;
        price_cents?: number;
        currency?: string;
        kind?: "group" | "entry";
        parent_id?: string | null;
        gender?: "male" | "female" | "open" | null;
        belt?: string | null;
        age_label?: string | null;
        age_min?: number | null;
        age_max?: number | null;
        weight_label?: string | null;
        weight_min_kg?: number | null;
        weight_max_kg?: number | null;
        sort_order?: number;
      },
) {
  const payload =
    typeof input === "string"
      ? { competition_id: competitionId, name: input.trim(), kind: "entry" as const }
      : {
          competition_id: competitionId,
          name: input.name.trim(),
          price_cents: input.price_cents ?? 0,
          currency: input.currency ?? "EUR",
          kind: input.kind ?? "entry",
          parent_id: input.parent_id ?? null,
          gender: input.gender ?? null,
          belt: input.belt ?? null,
          age_label: input.age_label ?? null,
          age_min: input.age_min ?? null,
          age_max: input.age_max ?? null,
          weight_label: input.weight_label ?? null,
          weight_min_kg: input.weight_min_kg ?? null,
          weight_max_kg: input.weight_max_kg ?? null,
          sort_order: input.sort_order ?? 0,
        };
  const { data, error } = await supabase
    .from("competition_divisions")
    .insert(payload as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as CompetitionDivision;
}

export async function updateDivision(
  divisionId: string,
  patch: Partial<{
    name: string;
    price_cents: number;
    currency: string;
    sort_order: number;
    gender: string | null;
    belt: string | null;
    age_label: string | null;
    age_min: number | null;
    age_max: number | null;
    weight_label: string | null;
    weight_min_kg: number | null;
    weight_max_kg: number | null;
  }>,
) {
  const { data, error } = await supabase
    .from("competition_divisions")
    .update(patch as never)
    .eq("id", divisionId)
    .select("*")
    .single();
  if (error) throw error;
  return data as CompetitionDivision;
}

export async function deleteDivision(divisionId: string) {
  const { error } = await supabase.from("competition_divisions").delete().eq("id", divisionId);
  if (error) throw error;
}

/** Create Male/Female Gi Adult group with IBJJF weight classes × belts. */
export async function createIbjjfAdultGiTemplate(
  competitionId: string,
  input: {
    gender: "male" | "female";
    price_cents: number;
    belts?: string[];
  },
) {
  const { IBJJF_ADULT_WEIGHTS, BJJ_BELTS } = await import("./eligibility");
  const belts = input.belts?.length ? input.belts : [...BJJ_BELTS];
  const label = input.gender === "male" ? "Male Gi" : "Female Gi";

  const group = await createDivision(competitionId, {
    name: label,
    kind: "group",
    gender: input.gender,
    age_label: "Adult",
    age_min: 18,
    price_cents: 0,
    sort_order: input.gender === "male" ? 0 : 1,
  });

  let order = 0;
  for (const belt of belts) {
    let prevMax = 0;
    for (const w of IBJJF_ADULT_WEIGHTS) {
      const name = w.maxKg
        ? `${label} / ${belt} / Adult / -${w.maxKg} kg (${w.label})`
        : `${label} / ${belt} / Adult / +${prevMax} kg (${w.label})`;
      await createDivision(competitionId, {
        name,
        kind: "entry",
        parent_id: group.id,
        gender: input.gender,
        belt,
        age_label: "Adult",
        age_min: 18,
        weight_label: w.label,
        weight_min_kg: w.maxKg == null ? prevMax : prevMax > 0 ? prevMax : null,
        weight_max_kg: w.maxKg,
        price_cents: input.price_cents,
        sort_order: order++,
      });
      if (w.maxKg != null) prevMax = w.maxKg;
    }
  }

  return fetchDivisions(competitionId);
}

export async function fetchMyProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data as import("./types").UserProfile | null;
}

export async function updateMyProfile(
  patch: Partial<{
    phone: string | null;
    nationality: string | null;
    gender: string | null;
    birth_date: string | null;
    full_name: string;
  }>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Precisas de sessão.");
  const { data, error } = await supabase
    .from("profiles")
    .update(patch as never)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as import("./types").UserProfile;
}

export async function updateMyAthlete(
  athleteId: string,
  patch: Partial<{
    belt: string | null;
    weight_kg: number | null;
    birth_date: string | null;
    full_name: string;
    category: string;
  }>,
) {
  const { data, error } = await supabase
    .from("athletes")
    .update(patch as never)
    .eq("id", athleteId)
    .select("*, academies(id, name, slug, city, affiliation)")
    .single();
  if (error) throw error;
  const row = data as any;
  return {
    ...row,
    academy: row.academies ?? null,
  } as Athlete;
}

export async function fetchAcademyById(id: string) {
  const { data, error } = await supabase.from("academies").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Academy | null;
}

export async function fetchEntries(competitionId: string) {
  const { data, error } = await supabase
    .from("competition_entries")
    .select("*, athlete:athletes(*, academies(id, name, slug, city, affiliation))")
    .eq("competition_id", competitionId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    athlete: row.athlete
      ? { ...row.athlete, academy: row.athlete.academies ?? null }
      : null,
  })) as CompetitionEntry[];
}

export async function setEntryApproved(entryId: string, approved: boolean) {
  const { data, error } = await supabase
    .from("competition_entries")
    .update({ approved } as never)
    .eq("id", entryId)
    .select("*, athlete:athletes(*, academies(id, name, slug, city, affiliation))")
    .single();
  if (error) throw error;
  const row = data as any;
  return {
    ...row,
    athlete: row.athlete ? { ...row.athlete, academy: row.athlete.academies ?? null } : null,
  } as CompetitionEntry;
}

export async function isCompetitionFavorited(competitionId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("competition_favorites")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function toggleCompetitionFavorite(competitionId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Precisas de sessão.");

  const { data: existing } = await supabase
    .from("competition_favorites")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("competition_favorites").delete().eq("id", existing.id);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from("competition_favorites").insert({
    competition_id: competitionId,
    user_id: user.id,
  } as never);
  if (error) throw error;
  return true;
}

export async function addEntry(competitionId: string, athleteId: string, divisionId?: string | null) {
  const { data, error } = await supabase
    .from("competition_entries")
    .insert({
      competition_id: competitionId,
      athlete_id: athleteId,
      division_id: divisionId ?? null,
    } as never)
    .select("*, athlete:athletes(*)")
    .single();
  if (error) throw error;
  return { ...data, athlete: (data as any).athlete ?? null } as CompetitionEntry;
}

export async function selfRegisterForCompetition(competitionId: string, divisionId?: string | null) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Precisas de sessão.");

  const { data: athlete, error: athErr } = await supabase
    .from("athletes")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (athErr) throw athErr;
  if (!athlete) throw new Error("Precisas de estar associado a uma academia (pedido aceite).");

  return addEntry(competitionId, athlete.id, divisionId);
}

export async function selfRegisterMany(competitionId: string, divisionIds: string[]) {
  const results = [];
  for (const divisionId of divisionIds) {
    results.push(await selfRegisterForCompetition(competitionId, divisionId));
  }
  return results;
}

export async function generateBracket(
  competitionId: string,
  divisionId: string,
  athleteIds: string[],
  opts?: { matNumber?: number },
) {
  const planned = planSingleElimination(athleteIds);
  const matNumber = opts?.matNumber ?? 1;

  await supabase.from("competition_matches").delete().eq("division_id", divisionId);

  const keyToId = new Map<string, string>();
  const rows = planned.map((p, i) => ({
    competition_id: competitionId,
    division_id: divisionId,
    mat_number: matNumber,
    sort_order: i,
    status: "queued" as const,
    athlete_a_id: p.athleteAId,
    athlete_b_id: p.athleteBId,
    round_index: p.roundIndex,
    match_index: p.matchIndex,
    next_match_id: null as string | null,
    next_slot: p.nextSlot,
    clock_seconds: 360,
    clock_running: false,
    _key: p.key,
    _next: p.nextMatchKey,
  }));

  const { data: inserted, error } = await supabase
    .from("competition_matches")
    .insert(rows.map(({ _key, _next, ...r }) => r) as never)
    .select("id, round_index, match_index");
  if (error) throw error;

  for (const row of inserted ?? []) {
    keyToId.set(`${row.round_index}:${row.match_index}`, row.id);
  }

  for (const p of planned) {
    if (!p.nextMatchKey) continue;
    const id = keyToId.get(p.key);
    const nextId = keyToId.get(p.nextMatchKey);
    if (id && nextId) {
      await supabase
        .from("competition_matches")
        .update({ next_match_id: nextId, next_slot: p.nextSlot } as never)
        .eq("id", id);
    }
  }

  await supabase.from("competitions").update({ status: "live" } as never).eq("id", competitionId);

  return fetchMatches(competitionId);
}

export async function setMatchWinner(
  matchId: string,
  winnerId: string,
  winMethod: import("./types").WinMethod = "points",
) {
  const { data: match, error } = await supabase.from("competition_matches").select("*").eq("id", matchId).single();
  if (error) throw error;

  const { error: upErr } = await supabase
    .from("competition_matches")
    .update({
      status: "finished",
      winner_id: winnerId,
      win_method: winMethod,
      clock_running: false,
    } as never)
    .eq("id", matchId);
  if (upErr) throw upErr;

  if (match.next_match_id && match.next_slot) {
    const patch = match.next_slot === "a" ? { athlete_a_id: winnerId } : { athlete_b_id: winnerId };
    await supabase.from("competition_matches").update(patch as never).eq("id", match.next_match_id);
  }
}

export async function claimMatchOnMat(matchId: string) {
  const match = await fetchMatch(matchId);
  if (!match) throw new Error("Luta não encontrada");
  if (match.status === "finished") return match;

  const mat = match.mat_number || 1;
  const siblings = await fetchMatches(match.competition_id);
  for (const m of siblings) {
    if (m.id === matchId) continue;
    if ((m.mat_number || 1) !== mat) continue;
    if (m.status !== "live") continue;
    await updateMatch(m.id, { status: "queued", clock_running: false });
  }

  if (match.status === "live") return match;
  return updateMatch(matchId, { status: "live", sides_swapped: false });
}

export async function updateMatch(
  matchId: string,
  patch: Partial<{
    estimated_start: string | null;
    mat_number: number;
    status: MatchStatus;
    score_a: number;
    score_b: number;
    advantages_a: number;
    advantages_b: number;
    penalties_a: number;
    penalties_b: number;
    clock_seconds: number;
    clock_running: boolean;
    clock_updated_at: string | null;
    sides_swapped: boolean;
  }>,
) {
  const body = { ...patch } as Record<string, unknown>;
  if (patch.clock_running != null || patch.clock_seconds != null) {
    body.clock_updated_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from("competition_matches")
    .update(body as never)
    .eq("id", matchId)
    .select(
      "*, athlete_a:athletes!competition_matches_athlete_a_id_fkey(*), athlete_b:athletes!competition_matches_athlete_b_id_fkey(*)",
    )
    .single();
  if (error) throw error;
  const row = data as any;
  return {
    ...row,
    athlete_a: row.athlete_a ?? null,
    athlete_b: row.athlete_b ?? null,
  } as CompetitionMatch;
}

export async function fetchMatches(competitionId: string) {
  const { data, error } = await supabase
    .from("competition_matches")
    .select(
      "*, athlete_a:athletes!competition_matches_athlete_a_id_fkey(*, academies(id, name, slug)), athlete_b:athletes!competition_matches_athlete_b_id_fkey(*, academies(id, name, slug))",
    )
    .eq("competition_id", competitionId)
    .order("round_index")
    .order("match_index");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    athlete_a: row.athlete_a
      ? { ...row.athlete_a, academy: row.athlete_a.academies ?? null }
      : null,
    athlete_b: row.athlete_b
      ? { ...row.athlete_b, academy: row.athlete_b.academies ?? null }
      : null,
  })) as CompetitionMatch[];
}

export async function fetchMatch(matchId: string) {
  const { data, error } = await supabase
    .from("competition_matches")
    .select(
      "*, athlete_a:athletes!competition_matches_athlete_a_id_fkey(*, academies(id, name, slug)), athlete_b:athletes!competition_matches_athlete_b_id_fkey(*, academies(id, name, slug))",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  return {
    ...row,
    athlete_a: row.athlete_a
      ? { ...row.athlete_a, academy: row.athlete_a.academies ?? null }
      : null,
    athlete_b: row.athlete_b
      ? { ...row.athlete_b, academy: row.athlete_b.academies ?? null }
      : null,
  } as CompetitionMatch;
}

/** Price considering early bird deadline (−20% before deadline). */
export function resolveEntryPriceCents(
  baseCents: number,
  deadlineEarlyAt: string | null | undefined,
  now = new Date(),
) {
  if (!deadlineEarlyAt) return baseCents;
  const early = new Date(deadlineEarlyAt);
  if (Number.isNaN(early.getTime()) || now.getTime() >= early.getTime()) return baseCents;
  return Math.round(baseCents * 0.8);
}

export async function markEntryPaid(
  entryId: string,
  input: { stripe_session_id?: string; amount_paid_cents?: number },
) {
  const { data, error } = await supabase
    .from("competition_entries")
    .update({
      paid: true,
      paid_at: new Date().toISOString(),
      approved: true,
      stripe_session_id: input.stripe_session_id ?? null,
      amount_paid_cents: input.amount_paid_cents ?? null,
    } as never)
    .eq("id", entryId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function ensureEntryCheckInCode(entryId: string) {
  const code = Math.random().toString(36).slice(2, 12).toUpperCase();
  const { data, error } = await supabase
    .from("competition_entries")
    .update({ check_in_code: code } as never)
    .eq("id", entryId)
    .is("check_in_code", null)
    .select("check_in_code")
    .maybeSingle();
  if (error) throw error;
  if (data?.check_in_code) return data.check_in_code as string;

  const { data: existing, error: e2 } = await supabase
    .from("competition_entries")
    .select("check_in_code")
    .eq("id", entryId)
    .single();
  if (e2) throw e2;
  return existing.check_in_code as string;
}

export async function checkInByCode(code: string) {
  const { data, error } = await supabase
    .from("competition_entries")
    .update({ checked_in_at: new Date().toISOString() } as never)
    .eq("check_in_code", code.trim().toUpperCase())
    .select("*, athlete:athletes(*)")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Código inválido.");
  return data as CompetitionEntry;
}

export async function fetchMyEntries() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [] as CompetitionEntry[];

  const { data: athletes } = await supabase
    .from("athletes")
    .select("id")
    .eq("user_id", user.id);
  const ids = (athletes ?? []).map((a) => a.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("competition_entries")
    .select("*, athlete:athletes(*), competitions(id, name, starts_at, cover_image_url)")
    .in("athlete_id", ids);
  if (error) throw error;
  return (data ?? []) as CompetitionEntry[];
}
