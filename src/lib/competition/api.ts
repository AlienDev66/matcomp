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
import { planBracket, type BracketFormat } from "./bracket";

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
  // DB trigger also expires staff; this is belt-and-suspenders for older schemas.
  if (status === "finished") {
    await supabase
      .from("event_staff")
      .update({ active: false, expires_at: new Date().toISOString() } as never)
      .eq("competition_id", competitionId)
      .eq("active", true);
  }
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
  federation_approval: "none" | "pending" | "approved" | "rejected";
  paused_mats: number[];
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
  return createDivisionTemplate(competitionId, {
    preset: "adult_gi",
    gender: input.gender,
    price_cents: input.price_cents,
    belts: input.belts,
  });
}

export async function createDivisionTemplate(
  competitionId: string,
  input: {
    preset: import("./eligibility").DivisionTemplatePreset;
    gender: "male" | "female";
    price_cents: number;
    belts?: string[];
  },
) {
  const { DIVISION_TEMPLATE_META } = await import("./eligibility");
  const meta = DIVISION_TEMPLATE_META[input.preset];
  const belts = input.belts?.length ? input.belts : [...meta.belts];
  const genderLabel = input.gender === "male" ? "Male" : "Female";
  const giLabel = meta.gi ? "Gi" : "No-Gi";
  const label = `${genderLabel} ${giLabel} · ${meta.age_label}`;

  const existing = await fetchDivisions(competitionId);
  const dup = existing.find((d) => d.kind === "group" && d.name === label);
  if (dup) return fetchDivisions(competitionId);

  const group = await createDivision(competitionId, {
    name: label,
    kind: "group",
    gender: input.gender,
    age_label: meta.age_label,
    age_min: meta.age_min,
    age_max: meta.age_max,
    price_cents: 0,
    sort_order: existing.filter((d) => d.kind === "group").length,
  });

  let order = 0;
  for (const belt of belts) {
    let prevMax = 0;
    for (const w of meta.weights) {
      const name = w.maxKg
        ? `${label} / ${belt} / -${w.maxKg} kg (${w.label})`
        : `${label} / ${belt} / +${prevMax} kg (${w.label})`;
      await createDivision(competitionId, {
        name,
        kind: "entry",
        parent_id: group.id,
        gender: input.gender,
        belt,
        age_label: meta.age_label,
        age_min: meta.age_min,
        age_max: meta.age_max,
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
  opts?: { matNumber?: number; format?: BracketFormat },
) {
  let format: BracketFormat = opts?.format ?? "single_elim";
  if (!opts?.format) {
    const { data: div } = await supabase
      .from("competition_divisions")
      .select("bracket_format")
      .eq("id", divisionId)
      .maybeSingle();
    if (div?.bracket_format) format = div.bracket_format as BracketFormat;
  } else {
    await supabase
      .from("competition_divisions")
      .update({ bracket_format: format } as never)
      .eq("id", divisionId);
  }

  const planned = planBracket(format, athleteIds);
  const matNumber = opts?.matNumber ?? 1;

  await supabase.from("competition_matches").delete().eq("division_id", divisionId);

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
    bracket_side: p.bracketSide ?? null,
    is_bye: !!p.isBye,
    loser_next_match_id: null as string | null,
    loser_next_slot: p.loserNextSlot ?? null,
    _key: p.key,
    _next: p.nextMatchKey,
    _loserNext: p.loserNextMatchKey ?? null,
  }));

  const { data: inserted, error } = await supabase
    .from("competition_matches")
    .insert(rows.map(({ _key, _next, _loserNext, ...r }) => r) as never)
    .select("id, round_index, match_index, sort_order");
  if (error) throw error;

  const keyToId = new Map<string, string>();
  for (const row of inserted ?? []) {
    const p = planned[row.sort_order];
    if (p) keyToId.set(p.key, row.id);
  }

  for (const p of planned) {
    const id = keyToId.get(p.key);
    if (!id) continue;
    const patch: Record<string, unknown> = {};
    if (p.nextMatchKey) {
      const nextId = keyToId.get(p.nextMatchKey);
      if (nextId) {
        patch.next_match_id = nextId;
        patch.next_slot = p.nextSlot;
      }
    }
    if (p.loserNextMatchKey) {
      const loserNextId = keyToId.get(p.loserNextMatchKey);
      if (loserNextId) {
        patch.loser_next_match_id = loserNextId;
        patch.loser_next_slot = p.loserNextSlot;
      }
    }
    if (Object.keys(patch).length) {
      await supabase.from("competition_matches").update(patch as never).eq("id", id);
    }
  }

  // Auto-resolve BYEs: advance the present athlete
  const { data: byes } = await supabase
    .from("competition_matches")
    .select("*")
    .eq("division_id", divisionId)
    .eq("is_bye", true);

  for (const m of byes ?? []) {
    const winnerId = m.athlete_a_id ?? m.athlete_b_id;
    if (!winnerId) continue;
    await setMatchWinner(m.id, winnerId, "walkover");
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
      call_a: "done",
      call_b: "done",
    } as never)
    .eq("id", matchId);
  if (upErr) throw upErr;

  if (match.next_match_id && match.next_slot) {
    const patch = match.next_slot === "a" ? { athlete_a_id: winnerId } : { athlete_b_id: winnerId };
    await supabase.from("competition_matches").update(patch as never).eq("id", match.next_match_id);
  }

  const loserId =
    match.athlete_a_id === winnerId
      ? match.athlete_b_id
      : match.athlete_b_id === winnerId
        ? match.athlete_a_id
        : null;
  if (loserId && match.loser_next_match_id && match.loser_next_slot) {
    const patch =
      match.loser_next_slot === "a" ? { athlete_a_id: loserId } : { athlete_b_id: loserId };
    await supabase
      .from("competition_matches")
      .update(patch as never)
      .eq("id", match.loser_next_match_id);
  }

  // When a division final (or consolation) finishes, refresh podium queue
  if (match.division_id) {
    try {
      await syncPodiumQueueForDivision(match.competition_id, match.division_id);
    } catch (err) {
      console.warn("[podium sync]", err);
    }
  }
}

export async function claimMatchOnMat(matchId: string) {
  const match = await fetchMatch(matchId);
  if (!match) throw new Error("Luta não encontrada");
  if (match.status === "finished") return match;

  const mat = match.mat_number || 1;
  const competition = await fetchCompetition(match.competition_id);
  if (competition?.paused_mats?.includes(mat)) {
    throw new Error(`Tatâmi ${mat} está pausado.`);
  }

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

// ─── Event staff / mesa tokens ───────────────────────────────────────────────

export async function fetchEventStaff(competitionId: string) {
  const { data, error } = await supabase
    .from("event_staff")
    .select("*")
    .eq("competition_id", competitionId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as import("./types").EventStaff[];
}

export async function createEventStaff(
  competitionId: string,
  input: {
    role: import("./types").EventStaffRole;
    mat_number?: number | null;
    label?: string;
    expires_at?: string | null;
  },
) {
  const competition = await fetchCompetition(competitionId);
  let expiresAt = input.expires_at ?? null;
  if (!expiresAt && competition) {
    if (competition.ends_at) {
      expiresAt = new Date(
        new Date(competition.ends_at).getTime() + 12 * 60 * 60 * 1000,
      ).toISOString();
    } else if (competition.starts_at) {
      expiresAt = new Date(
        new Date(competition.starts_at).getTime() + 48 * 60 * 60 * 1000,
      ).toISOString();
    } else {
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  const { data, error } = await supabase
    .from("event_staff")
    .insert({
      competition_id: competitionId,
      role: input.role,
      mat_number: input.mat_number ?? null,
      label: input.label ?? null,
      active: true,
      expires_at: expiresAt,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as import("./types").EventStaff;
}

export async function revokeEventStaff(staffId: string) {
  const { error } = await supabase
    .from("event_staff")
    .update({ active: false } as never)
    .eq("id", staffId);
  if (error) throw error;
}

export async function resolveMesaToken(token: string) {
  const { data, error } = await supabase.rpc("resolve_mesa_token", { _token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as {
    staff_id: string;
    competition_id: string;
    role: import("./types").EventStaffRole;
    mat_number: number | null;
    label: string | null;
  } | null;
}

export async function mesaUpdateMatch(
  matchId: string,
  token: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc("mesa_update_match", {
    _match_id: matchId,
    _token: token,
    _patch: patch,
  });
  if (error) throw error;
  return data as CompetitionMatch;
}

export async function mesaSetWinner(
  matchId: string,
  token: string,
  winnerId: string,
  winMethod: string = "points",
) {
  const { data, error } = await supabase.rpc("mesa_set_winner", {
    _match_id: matchId,
    _token: token,
    _winner_id: winnerId,
    _win_method: winMethod,
  });
  if (error) throw error;
  return data as CompetitionMatch;
}

export async function redistributeMats(competitionId: string, matsCount: number) {
  const n = Math.max(1, matsCount);
  const matches = await fetchMatches(competitionId);
  const active = matches.filter((m) => m.status !== "finished" && m.status !== "cancelled");
  let i = 0;
  for (const m of active) {
    const mat = (i % n) + 1;
    await updateMatch(m.id, { mat_number: mat });
    i += 1;
  }
  return fetchMatches(competitionId);
}

export async function requestFederationApproval(competitionId: string) {
  const { data, error } = await supabase
    .from("competitions")
    .update({ federation_approval: "pending" } as never)
    .eq("id", competitionId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Competition;
}

export async function setFederationApproval(
  competitionId: string,
  status: "approved" | "rejected",
) {
  const { data, error } = await supabase
    .from("competitions")
    .update({ federation_approval: status } as never)
    .eq("id", competitionId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Competition;
}

export async function fetchPendingFederationEvents(federationId: string) {
  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .eq("federation_id", federationId)
    .eq("federation_approval", "pending")
    .order("starts_at");
  if (error) throw error;
  return (data ?? []) as Competition[];
}

export async function isFederationAdmin(federationId: string) {
  const { data, error } = await supabase.rpc("is_federation_admin", {
    _federation_id: federationId,
  });
  if (error) return false;
  return !!data;
}

export async function ensureFederationAdmin(federationId: string, userId: string) {
  const { error } = await supabase.from("federation_admins").upsert(
    { federation_id: federationId, user_id: userId } as never,
    { onConflict: "federation_id,user_id" },
  );
  if (error && !error.message.includes("duplicate")) throw error;
}

// ─── Day ops: weigh-in, reopen, pause, ETA ───────────────────────────────────

export async function recordWeighIn(
  entryId: string,
  input: {
    weigh_in_kg: number;
    weigh_in_status: "passed" | "failed";
  },
) {
  const { data, error } = await supabase
    .from("competition_entries")
    .update({
      weigh_in_kg: input.weigh_in_kg,
      weigh_in_status: input.weigh_in_status,
      weigh_in_at: new Date().toISOString(),
    } as never)
    .eq("id", entryId)
    .select("*, athlete:athletes(*)")
    .single();
  if (error) throw error;
  return data as CompetitionEntry;
}

export async function setMatPaused(
  competitionId: string,
  matNumber: number,
  paused: boolean,
) {
  const competition = await fetchCompetition(competitionId);
  if (!competition) throw new Error("Evento não encontrado");
  const current = new Set(competition.paused_mats ?? []);
  if (paused) current.add(matNumber);
  else current.delete(matNumber);
  return updateCompetition(competitionId, { paused_mats: [...current].sort((a, b) => a - b) });
}

/** Undo a finished fight: clear winner, pull athletes back from next slots if still open. */
export async function reopenMatch(matchId: string) {
  const match = await fetchMatch(matchId);
  if (!match) throw new Error("Luta não encontrada");
  if (match.status !== "finished") {
    throw new Error("Só podes reabrir lutas terminadas.");
  }

  const winnerId = match.winner_id;
  const loserId =
    match.athlete_a_id === winnerId
      ? match.athlete_b_id
      : match.athlete_b_id === winnerId
        ? match.athlete_a_id
        : null;

  if (match.next_match_id && match.next_slot && winnerId) {
    const next = await fetchMatch(match.next_match_id);
    if (next && next.status !== "finished") {
      const patch: Record<string, null> = {};
      if (match.next_slot === "a" && next.athlete_a_id === winnerId) patch.athlete_a_id = null;
      if (match.next_slot === "b" && next.athlete_b_id === winnerId) patch.athlete_b_id = null;
      if (Object.keys(patch).length) {
        await supabase
          .from("competition_matches")
          .update(patch as never)
          .eq("id", match.next_match_id);
      }
    }
  }

  if (match.loser_next_match_id && match.loser_next_slot && loserId) {
    const next = await fetchMatch(match.loser_next_match_id);
    if (next && next.status !== "finished") {
      const patch: Record<string, null> = {};
      if (match.loser_next_slot === "a" && next.athlete_a_id === loserId) patch.athlete_a_id = null;
      if (match.loser_next_slot === "b" && next.athlete_b_id === loserId) patch.athlete_b_id = null;
      if (Object.keys(patch).length) {
        await supabase
          .from("competition_matches")
          .update(patch as never)
          .eq("id", match.loser_next_match_id);
      }
    }
  }

  const { data, error } = await supabase
    .from("competition_matches")
    .update({
      status: "queued",
      winner_id: null,
      win_method: null,
      clock_running: false,
      sides_swapped: false,
    } as never)
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

export async function recalculateEtas(
  competitionId: string,
  opts?: { avgMatchSeconds?: number; gapSeconds?: number },
) {
  const { computeMatEtas } = await import("./eta");
  const matches = await fetchMatches(competitionId);
  const assignments = computeMatEtas(matches, opts);
  for (const a of assignments) {
    await supabase
      .from("competition_matches")
      .update({ estimated_start: a.estimated_start } as never)
      .eq("id", a.matchId);
  }
  return fetchMatches(competitionId);
}

export async function fetchEmailOutbox(competitionId: string) {
  const { data, error } = await supabase
    .from("email_outbox")
    .select("*")
    .eq("competition_id", competitionId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as {
    id: string;
    email_type: string;
    to_email: string;
    subject: string | null;
    sent_at: string | null;
    error: string | null;
    created_at: string;
  }[];
}

// ─── Day stations: pesagem / chamada / pódio ─────────────────────────────────

export async function staffRecordWeighIn(
  entryId: string,
  token: string,
  kg: number,
  status: "passed" | "failed",
) {
  const { data, error } = await supabase.rpc("staff_record_weigh_in", {
    _entry_id: entryId,
    _token: token,
    _kg: kg,
    _status: status,
  });
  if (error) throw error;
  return data as CompetitionEntry;
}

export async function staffSetMatchCall(
  matchId: string,
  token: string,
  side: "a" | "b",
  status: import("./types").AthleteCallStatus,
) {
  const { data, error } = await supabase.rpc("staff_set_match_call", {
    _match_id: matchId,
    _token: token,
    _side: side,
    _status: status,
  });
  if (error) throw error;
  return data as CompetitionMatch;
}

export async function setMatchCall(
  matchId: string,
  side: "a" | "b",
  status: import("./types").AthleteCallStatus,
) {
  const patch =
    side === "a"
      ? { call_a: status, call_a_at: new Date().toISOString() }
      : { call_b: status, call_b_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("competition_matches")
    .update(patch as never)
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

export async function fetchPodiumCalls(competitionId: string) {
  const { data, error } = await supabase
    .from("podium_calls")
    .select("*, athlete:athletes(id, full_name)")
    .eq("competition_id", competitionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    athlete: row.athlete ?? null,
  })) as import("./types").PodiumCall[];
}

export async function staffSetPodiumStatus(
  podiumId: string,
  token: string,
  status: import("./types").PodiumCallStatus,
) {
  const { data, error } = await supabase.rpc("staff_set_podium_status", {
    _podium_id: podiumId,
    _token: token,
    _status: status,
  });
  if (error) throw error;
  return data as import("./types").PodiumCall;
}

export async function setPodiumStatus(
  podiumId: string,
  status: import("./types").PodiumCallStatus,
) {
  const patch: Record<string, unknown> = { status };
  if (status === "called") patch.called_at = new Date().toISOString();
  if (status === "done" || status === "skipped") patch.done_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("podium_calls")
    .update(patch as never)
    .eq("id", podiumId)
    .select("*, athlete:athletes(id, full_name)")
    .single();
  if (error) throw error;
  const row = data as any;
  return { ...row, athlete: row.athlete ?? null } as import("./types").PodiumCall;
}

/** Upsert podium rows from derived medals when a division has results. */
export async function syncPodiumQueueForDivision(competitionId: string, divisionId: string) {
  const { deriveMedals } = await import("./medals");
  const matches = await fetchMatches(competitionId);
  const divMatches = matches.filter((m) => m.division_id === divisionId);
  const row = deriveMedals(divMatches).find((d) => d.divisionId === divisionId);
  if (!row) return;

  const inserts: {
    competition_id: string;
    division_id: string;
    athlete_id: string;
    medal: "gold" | "silver" | "bronze";
  }[] = [];

  if (row.gold) {
    inserts.push({
      competition_id: competitionId,
      division_id: divisionId,
      athlete_id: row.gold.athleteId,
      medal: "gold",
    });
  }
  if (row.silver) {
    inserts.push({
      competition_id: competitionId,
      division_id: divisionId,
      athlete_id: row.silver.athleteId,
      medal: "silver",
    });
  }
  for (const b of row.bronze) {
    inserts.push({
      competition_id: competitionId,
      division_id: divisionId,
      athlete_id: b.athleteId,
      medal: "bronze",
    });
  }

  if (inserts.length === 0) return;

  const { error } = await supabase.from("podium_calls").upsert(inserts as never, {
    onConflict: "competition_id,division_id,athlete_id,medal",
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

export async function syncAllPodiumQueues(competitionId: string) {
  const matches = await fetchMatches(competitionId);
  const divIds = [...new Set(matches.map((m) => m.division_id).filter(Boolean))] as string[];
  for (const d of divIds) {
    await syncPodiumQueueForDivision(competitionId, d);
  }
  return fetchPodiumCalls(competitionId);
}

/** Notify athlete via email/outbox when called to warmup/mat. */
export async function notifyAthleteCall(opts: {
  competitionId: string;
  competitionName: string;
  athleteId: string;
  mat: number;
  phase: "warmup" | "mat" | "weigh_in" | "podium";
}) {
  try {
    const { data: athlete } = await supabase
      .from("athletes")
      .select("full_name, user_id")
      .eq("id", opts.athleteId)
      .maybeSingle();
    if (!athlete?.user_id) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", athlete.user_id)
      .maybeSingle();
    if (!profile?.email) return;
    const { queueAndSendEmail } = await import("@/lib/email.server");
    await queueAndSendEmail({
      data: {
        type: "queue_call",
        toEmail: profile.email,
        competitionId: opts.competitionId,
        payload: {
          competitionName: opts.competitionName,
          athleteName: athlete.full_name,
          mat: opts.mat,
          phase: opts.phase,
        },
      },
    });
  } catch (err) {
    console.warn("[notifyAthleteCall]", err);
  }
}
