import { supabase } from "@/integrations/supabase/client";
import type { Academy, Athlete, Competition, CompetitionDivision, CompetitionEntry, CompetitionMatch } from "./types";
import { slugify } from "./types";
import { planSingleElimination } from "./bracket";

export async function fetchMyAcademies() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [] as Academy[];

  const { data: memberships, error } = await supabase
    .from("academy_members")
    .select("academy_id, role, academies(*)")
    .eq("user_id", user.id);
  if (error) throw error;

  return (memberships ?? [])
    .map((m: any) => m.academies as Academy)
    .filter(Boolean);
}

export async function fetchAcademyBySlug(slug: string) {
  const { data, error } = await supabase.from("academies").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data as Academy | null;
}

export async function createAcademy(input: { name: string; city?: string; slug?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
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
  const { data, error } = await supabase
    .from("athletes")
    .insert({
      academy_id: academyId,
      full_name: input.full_name.trim(),
      belt: input.belt ?? "white",
      category: input.category ?? "adult",
      weight_kg: input.weight_kg ?? null,
    } as never)
    .select("*")
    .single();
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

export async function createCompetition(
  academyId: string,
  input: { name: string; venue?: string; starts_at?: string | null },
) {
  const slug = slugify(input.name) || `comp-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("competitions")
    .insert({
      academy_id: academyId,
      name: input.name.trim(),
      slug,
      venue: input.venue?.trim() || null,
      starts_at: input.starts_at || null,
      status: "draft",
    } as never)
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

export async function createDivision(competitionId: string, name: string) {
  const { data, error } = await supabase
    .from("competition_divisions")
    .insert({ competition_id: competitionId, name: name.trim() } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as CompetitionDivision;
}

export async function fetchEntries(competitionId: string) {
  const { data, error } = await supabase
    .from("competition_entries")
    .select("*, athlete:athletes(*)")
    .eq("competition_id", competitionId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    athlete: row.athlete ?? null,
  })) as CompetitionEntry[];
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

export async function fetchMatches(competitionId: string) {
  const { data, error } = await supabase
    .from("competition_matches")
    .select("*, athlete_a:athletes!competition_matches_athlete_a_id_fkey(*), athlete_b:athletes!competition_matches_athlete_b_id_fkey(*)")
    .eq("competition_id", competitionId)
    .order("round_index")
    .order("match_index");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    athlete_a: row.athlete_a ?? null,
    athlete_b: row.athlete_b ?? null,
  })) as CompetitionMatch[];
}

export async function generateBracket(competitionId: string, divisionId: string, athleteIds: string[]) {
  const planned = planSingleElimination(athleteIds);

  // Clear existing matches for this division
  await supabase.from("competition_matches").delete().eq("division_id", divisionId);

  const keyToId = new Map<string, string>();
  const rows = planned.map((p, i) => ({
    competition_id: competitionId,
    division_id: divisionId,
    mat_number: 1,
    sort_order: i,
    status: "queued" as const,
    athlete_a_id: p.athleteAId,
    athlete_b_id: p.athleteBId,
    round_index: p.roundIndex,
    match_index: p.matchIndex,
    next_match_id: null as string | null,
    next_slot: p.nextSlot,
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

  await supabase
    .from("competitions")
    .update({ status: "live" } as never)
    .eq("id", competitionId);

  return fetchMatches(competitionId);
}

export async function setMatchWinner(matchId: string, winnerId: string) {
  const { data: match, error } = await supabase
    .from("competition_matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (error) throw error;

  const { error: upErr } = await supabase
    .from("competition_matches")
    .update({
      status: "finished",
      winner_id: winnerId,
    } as never)
    .eq("id", matchId);
  if (upErr) throw upErr;

  if (match.next_match_id && match.next_slot) {
    const patch =
      match.next_slot === "a"
        ? { athlete_a_id: winnerId }
        : { athlete_b_id: winnerId };
    await supabase.from("competition_matches").update(patch as never).eq("id", match.next_match_id);
  }
}
