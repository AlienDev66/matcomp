/**
 * Seed demo data — rich scenarios for local / staging.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API → service_role).
 * Never commit that key. Never use it in the browser.
 *
 * Usage:  bun run seed
 *
 * All login accounts share password: MatCompDemo1!
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { IBJJF_ADULT_WEIGHTS } from "../src/lib/competition/eligibility";
import { planSingleElimination } from "../src/lib/competition/bracket";
import type { WinMethod } from "../src/lib/competition/types";

const DEMO_PASSWORD = "MatCompDemo1!";
const SEED_TAG = "matcomp-demo";

type DemoUser = {
  email: string;
  fullName: string;
  gender?: "male" | "female" | "other";
  birthDate?: string;
  phone?: string;
  nationality?: string;
};

const USERS: DemoUser[] = [
  {
    email: "organizador@matcomp.demo",
    fullName: "Ana Organizadora",
    gender: "female",
    birthDate: "1988-04-12",
    phone: "+351910000001",
    nationality: "PT",
  },
  {
    email: "coach@matcomp.demo",
    fullName: "Carlos Coach",
    gender: "male",
    birthDate: "1985-09-01",
    phone: "+351910000002",
    nationality: "PT",
  },
  {
    email: "referee@matcomp.demo",
    fullName: "Marta Árbitro",
    gender: "female",
    birthDate: "1990-01-15",
    phone: "+351910000003",
    nationality: "PT",
  },
  {
    email: "atleta1@matcomp.demo",
    fullName: "João Silva",
    gender: "male",
    birthDate: "1995-03-20",
    phone: "+351910000011",
    nationality: "PT",
  },
  {
    email: "atleta2@matcomp.demo",
    fullName: "Miguel Costa",
    gender: "male",
    birthDate: "1998-07-15",
    phone: "+351910000012",
    nationality: "PT",
  },
  {
    email: "atleta3@matcomp.demo",
    fullName: "Sofia Mendes",
    gender: "female",
    birthDate: "1997-11-08",
    phone: "+351910000013",
    nationality: "PT",
  },
  {
    email: "atleta4@matcomp.demo",
    fullName: "Pedro Alves",
    gender: "male",
    birthDate: "2000-01-30",
    phone: "+351910000014",
    nationality: "BR",
  },
  {
    email: "atleta5@matcomp.demo",
    fullName: "Tiago Rocha",
    gender: "male",
    birthDate: "1996-06-12",
    phone: "+351910000015",
    nationality: "PT",
  },
  {
    email: "atleta6@matcomp.demo",
    fullName: "Bruno Dias",
    gender: "male",
    birthDate: "1994-02-28",
    phone: "+351910000016",
    nationality: "PT",
  },
  {
    email: "atleta7@matcomp.demo",
    fullName: "Inês Ferreira",
    gender: "female",
    birthDate: "1999-08-19",
    phone: "+351910000017",
    nationality: "PT",
  },
  {
    email: "atleta8@matcomp.demo",
    fullName: "Rui Martins",
    gender: "male",
    birthDate: "2001-12-03",
    phone: "+351910000018",
    nationality: "PT",
  },
  {
    email: "pendente@matcomp.demo",
    fullName: "Rita Pendente",
    gender: "female",
    birthDate: "1999-05-05",
    phone: "+351910000099",
    nationality: "PT",
  },
];

const FIRST_M = [
  "André", "Diogo", "Gonçalo", "Hugo", "Ivo", "Leandro", "Nuno", "Óscar", "Paulo", "Ricardo",
  "Sérgio", "Tomás", "Vítor", "Xavier", "Yuri", "Daniel", "Fábio", "Hélder", "Jorge", "Lucas",
  "Manuel", "Nelson", "Orlando", "Quim", "Renato", "Samuel", "Telmo", "Ulisses", "Vasco", "Wilson",
  "Afonso", "Bernardo", "César", "Dinis", "Eduardo", "Francisco", "Gustavo", "Henrique", "Isaac", "Joaquim",
];
const FIRST_F = [
  "Ana", "Beatriz", "Catarina", "Diana", "Eva", "Filipa", "Gabriela", "Helena", "Isabel", "Joana",
  "Lara", "Marta", "Nadia", "Olívia", "Patrícia", "Raquel", "Sara", "Teresa", "Úrsula", "Vera",
  "Camila", "Débora", "Elisa", "Francisca", "Ingrid", "Júlia", "Leonor", "Matilde", "Noémia", "Paula",
];
const LAST = [
  "Almeida", "Barbosa", "Carvalho", "Domingues", "Esteves", "Fonseca", "Gomes", "Henriques",
  "Ibrahim", "Jesus", "Lopes", "Morais", "Nogueira", "Oliveira", "Pereira", "Queirós",
  "Ribeiro", "Santos", "Teixeira", "Vargas", "Araújo", "Batista", "Correia", "Duarte",
  "Figueiredo", "Guimarães", "Lima", "Machado", "Neves", "Pinto", "Rodrigues", "Sousa",
];

const BELTS = ["white", "blue", "purple", "brown", "black"] as const;
const WEIGHT_CAPS = [57.5, 64, 70, 76, 82.3, 88.3, 94.3, 100.5] as const;
const WIN_METHODS: WinMethod[] = [
  "points",
  "submission",
  "advantage",
  "decision",
  "walkover",
  "disqualification",
  "no_show",
];

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function requireEnv() {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    console.error(`
Falta configuração. No .env / .env.local:

  VITE_SUPABASE_URL=https://xxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJ…   # service_role (secret!)

Depois: bun run seed
`);
    process.exit(1);
  }
  return { url, serviceKey };
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function birthForAge(age: number) {
  const y = new Date().getFullYear() - age;
  const m = String((age % 12) + 1).padStart(2, "0");
  const day = String((age % 27) + 1).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pick<T>(arr: readonly T[], i: number) {
  return arr[i % arr.length]!;
}

async function ensureUser(
  admin: SupabaseClient,
  u: DemoUser,
): Promise<{ id: string; created: boolean }> {
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id")
    .eq("email", u.email)
    .maybeSingle();

  if (profile?.user_id) {
    await admin
      .from("profiles")
      .update({
        full_name: u.fullName,
        phone: u.phone ?? null,
        nationality: u.nationality ?? null,
        gender: u.gender ?? null,
        birth_date: u.birthDate ?? null,
      })
      .eq("user_id", profile.user_id);
    return { id: profile.user_id, created: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.fullName, seed: SEED_TAG },
  });

  if (error) {
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = listed?.users?.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
    if (existing) {
      await admin
        .from("profiles")
        .update({
          full_name: u.fullName,
          email: u.email,
          phone: u.phone ?? null,
          nationality: u.nationality ?? null,
          gender: u.gender ?? null,
          birth_date: u.birthDate ?? null,
        })
        .eq("user_id", existing.id);
      return { id: existing.id, created: false };
    }
    throw error;
  }
  if (!data.user) throw new Error(`Falha a criar ${u.email}`);

  await admin
    .from("profiles")
    .update({
      full_name: u.fullName,
      phone: u.phone ?? null,
      nationality: u.nationality ?? null,
      gender: u.gender ?? null,
      birth_date: u.birthDate ?? null,
    })
    .eq("user_id", data.user.id);

  return { id: data.user.id, created: true };
}

async function ensureFederation(
  admin: SupabaseClient,
  row: {
    name: string;
    slug: string;
    subdomain: string;
    website_url?: string;
    primary_color?: string;
  },
) {
  const { data: existing } = await admin.from("federations").select("*").eq("slug", row.slug).maybeSingle();
  if (existing) return existing;
  const { data, error } = await admin.from("federations").insert(row).select("*").single();
  if (error) throw error;
  return data;
}

async function ensureAcademy(
  admin: SupabaseClient,
  row: {
    name: string;
    slug: string;
    city: string;
    affiliation?: string;
    primary_color?: string;
  },
  ownerId: string,
) {
  let { data: academy } = await admin.from("academies").select("*").eq("slug", row.slug).maybeSingle();
  if (!academy) {
    const { data, error } = await admin
      .from("academies")
      .insert({
        ...row,
        country: "PT",
        require_member_approval: true,
      })
      .select("*")
      .single();
    if (error) throw error;
    academy = data;
  }

  const { data: member } = await admin
    .from("academy_members")
    .select("id")
    .eq("academy_id", academy.id)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (!member) {
    const { error } = await admin.from("academy_members").insert({
      academy_id: academy.id,
      user_id: ownerId,
      role: "owner",
    });
    if (error) throw error;
  }
  return academy;
}

async function ensureAthleteAccount(
  admin: SupabaseClient,
  input: {
    academyId: string;
    userId: string;
    fullName: string;
    belt: string;
    weightKg: number;
    birthDate: string;
    gender?: string;
    countryCode?: string;
  },
) {
  const { data: existing } = await admin
    .from("athletes")
    .select("*")
    .eq("user_id", input.userId)
    .maybeSingle();
  const payload = {
    academy_id: input.academyId,
    full_name: input.fullName,
    belt: input.belt,
    weight_kg: input.weightKg,
    birth_date: input.birthDate,
    country_code: input.countryCode ?? "PT",
    category: "adult",
    active: true,
    affiliation: SEED_TAG,
  };
  if (existing) {
    const { data, error } = await admin
      .from("athletes")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await admin
    .from("athletes")
    .insert({ ...payload, user_id: input.userId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Roster athletes without login (for big brackets). Idempotent by academy + name. */
async function ensureBulkAthlete(
  admin: SupabaseClient,
  input: {
    academyId: string;
    fullName: string;
    belt: string;
    weightKg: number;
    birthDate: string;
    gender: "male" | "female";
    countryCode?: string;
  },
) {
  const { data: existing } = await admin
    .from("athletes")
    .select("*")
    .eq("academy_id", input.academyId)
    .eq("full_name", input.fullName)
    .eq("affiliation", SEED_TAG)
    .maybeSingle();
  const payload = {
    academy_id: input.academyId,
    full_name: input.fullName,
    belt: input.belt,
    weight_kg: input.weightKg,
    birth_date: input.birthDate,
    country_code: input.countryCode ?? "PT",
    category: "adult",
    active: true,
    affiliation: SEED_TAG,
    user_id: null as string | null,
  };
  if (existing) {
    const { data, error } = await admin.from("athletes").update(payload).eq("id", existing.id).select("*").single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await admin.from("athletes").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

async function ensureCompetition(
  admin: SupabaseClient,
  input: {
    academyId: string;
    createdBy: string;
    federationId: string | null;
    name: string;
    slug: string;
    status: "draft" | "registration" | "live" | "finished";
    venue: string;
    mapQuery: string;
    matsCount: number;
    startsOffsetDays: number;
    durationDays?: number;
    contactEmail: string;
  },
) {
  const { data: existing } = await admin
    .from("competitions")
    .select("*")
    .eq("slug", input.slug)
    .eq("created_by", input.createdBy)
    .maybeSingle();

  const starts = daysFromNow(input.startsOffsetDays);
  const ends = new Date(starts.getTime() + (input.durationDays ?? 2) * 24 * 3600 * 1000);
  const early = daysFromNow(Math.min(input.startsOffsetDays - 7, -1));

  const patch = {
    academy_id: input.academyId,
    federation_id: input.federationId,
    name: input.name,
    status: input.status,
    venue: input.venue,
    map_query: input.mapQuery,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    deadline_early_at: early.toISOString(),
    contact_email: input.contactEmail,
    organizer_years: 5,
    organizer_events_count: 24,
    mats_count: input.matsCount,
    notes: `seed:${SEED_TAG}`,
    info_pt:
      "PESAGEM\n\nA pesagem permanece aberta durante o evento.\n\nPOLÍTICA DE REEMBOLSO\n\nSem adversário adequado, pode haver crédito para eventos futuros.",
    info_en: "Weigh-in stays open during the event.",
  };

  if (existing) {
    const { data, error } = await admin
      .from("competitions")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await admin
    .from("competitions")
    .insert({
      ...patch,
      created_by: input.createdBy,
      slug: input.slug,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function ensureIbjjfGroup(
  admin: SupabaseClient,
  competitionId: string,
  gender: "male" | "female",
  priceCents: number,
  belts: readonly string[] = ["white", "blue", "purple", "brown", "black"],
) {
  const label = gender === "male" ? "Male Gi" : "Female Gi";
  const { data: existingGroup } = await admin
    .from("competition_divisions")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("kind", "group")
    .eq("name", label)
    .maybeSingle();

  let group = existingGroup;
  if (!group) {
    const { data, error } = await admin
      .from("competition_divisions")
      .insert({
        competition_id: competitionId,
        name: label,
        kind: "group",
        gender,
        age_label: "Adult",
        age_min: 18,
        age_max: 29,
        price_cents: 0,
        currency: "EUR",
        sort_order: gender === "male" ? 0 : 1,
      })
      .select("*")
      .single();
    if (error) throw error;
    group = data;
  }

  const { count } = await admin
    .from("competition_divisions")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", group.id);

  if ((count ?? 0) > 0) return group;

  const rows: Record<string, unknown>[] = [];
  let sort = 0;
  for (const belt of belts) {
    let prevMax = 0;
    for (const w of IBJJF_ADULT_WEIGHTS) {
      const name = w.maxKg
        ? `${label} / ${belt} / Adult / -${w.maxKg} kg (${w.label})`
        : `${label} / ${belt} / Adult / +${prevMax} kg (${w.label})`;
      rows.push({
        competition_id: competitionId,
        parent_id: group.id,
        name,
        kind: "entry",
        gender,
        belt,
        age_label: "Adult",
        age_min: 18,
        age_max: 29,
        weight_label: w.label,
        weight_min_kg: w.maxKg == null ? prevMax : prevMax > 0 ? prevMax : null,
        weight_max_kg: w.maxKg,
        price_cents: priceCents,
        currency: "EUR",
        sort_order: sort++,
      });
      if (w.maxKg != null) prevMax = w.maxKg;
    }
  }
  const { error } = await admin.from("competition_divisions").insert(rows);
  if (error) throw error;
  return group;
}

async function ensureAbsoluteDivision(admin: SupabaseClient, competitionId: string, name = "Absoluto Adulto OPEN") {
  const { data: existing } = await admin
    .from("competition_divisions")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await admin
    .from("competition_divisions")
    .insert({
      competition_id: competitionId,
      name,
      kind: "entry",
      gender: "open",
      age_label: "Adult",
      belt: null,
      price_cents: 1500,
      currency: "EUR",
      sort_order: 99,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function ensureEntry(
  admin: SupabaseClient,
  competitionId: string,
  athleteId: string,
  divisionId: string,
  approved = true,
) {
  const { data: existing } = await admin
    .from("competition_entries")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("athlete_id", athleteId)
    .eq("division_id", divisionId)
    .maybeSingle();
  if (existing) {
    if (existing.approved !== approved) {
      await admin.from("competition_entries").update({ approved }).eq("id", existing.id);
    }
    return existing;
  }
  const { data, error } = await admin
    .from("competition_entries")
    .insert({
      competition_id: competitionId,
      athlete_id: athleteId,
      division_id: divisionId,
      approved,
      check_in_code: `D${athleteId.slice(0, 6)}${divisionId.slice(0, 4)}`.toUpperCase(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function findEntryDivision(
  admin: SupabaseClient,
  competitionId: string,
  opts: { belt: string; maxKg: number; gender: "male" | "female" },
) {
  const { data } = await admin
    .from("competition_divisions")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("kind", "entry")
    .eq("belt", opts.belt)
    .eq("weight_max_kg", opts.maxKg)
    .eq("gender", opts.gender)
    .limit(1)
    .maybeSingle();
  return data;
}

async function listEntryDivisions(admin: SupabaseClient, competitionId: string) {
  const { data, error } = await admin
    .from("competition_divisions")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("kind", "entry")
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

async function seedGenerateBracket(
  admin: SupabaseClient,
  competitionId: string,
  divisionId: string,
  athleteIds: string[],
  matNumber: number,
) {
  const planned = planSingleElimination(athleteIds);
  await admin.from("competition_matches").delete().eq("division_id", divisionId);

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

  const { data: inserted, error } = await admin
    .from("competition_matches")
    .insert(rows.map(({ _key, _next, ...r }) => r))
    .select("id, round_index, match_index");
  if (error) throw error;

  const keyToId = new Map<string, string>();
  for (const row of inserted ?? []) {
    keyToId.set(`${row.round_index}:${row.match_index}`, row.id);
  }

  for (const p of planned) {
    if (!p.nextMatchKey) continue;
    const id = keyToId.get(p.key);
    const nextId = keyToId.get(p.nextMatchKey);
    if (id && nextId) {
      await admin
        .from("competition_matches")
        .update({ next_match_id: nextId, next_slot: p.nextSlot })
        .eq("id", id);
    }
  }

  return keyToId.size;
}

async function finishMatch(
  admin: SupabaseClient,
  match: {
    id: string;
    athlete_a_id: string | null;
    athlete_b_id: string | null;
    next_match_id: string | null;
    next_slot: string | null;
  },
  winnerSide: "a" | "b",
  method: WinMethod,
  scoreA: number,
  scoreB: number,
) {
  const winnerId = winnerSide === "a" ? match.athlete_a_id : match.athlete_b_id;
  if (!winnerId) return;
  await admin
    .from("competition_matches")
    .update({
      status: "finished",
      winner_id: winnerId,
      win_method: method,
      score_a: scoreA,
      score_b: scoreB,
      advantages_a: winnerSide === "a" ? 1 : 0,
      advantages_b: winnerSide === "b" ? 1 : 0,
      clock_running: false,
      clock_seconds: 120,
    })
    .eq("id", match.id);

  if (match.next_match_id && match.next_slot) {
    const patch =
      match.next_slot === "a" ? { athlete_a_id: winnerId } : { athlete_b_id: winnerId };
    await admin.from("competition_matches").update(patch).eq("id", match.next_match_id);
  }
}

/** Progress round 0 (and maybe more) so mesas have finished + live + queued. */
async function simulateBracketProgress(
  admin: SupabaseClient,
  competitionId: string,
  opts: { finishRound0Ratio: number; livePerMat: number },
) {
  const { data: matches } = await admin
    .from("competition_matches")
    .select("*")
    .eq("competition_id", competitionId)
    .order("mat_number")
    .order("round_index")
    .order("match_index");

  if (!matches?.length) return { finished: 0, live: 0 };

  let finished = 0;
  const round0 = matches.filter(
    (m) =>
      m.round_index === 0 &&
      m.athlete_a_id &&
      m.athlete_b_id &&
      m.status === "queued",
  );

  const toFinish = Math.floor(round0.length * opts.finishRound0Ratio);
  for (let i = 0; i < toFinish; i++) {
    const m = round0[i]!;
    const side: "a" | "b" = i % 2 === 0 ? "a" : "b";
    await finishMatch(
      admin,
      m,
      side,
      pick(WIN_METHODS, i),
      side === "a" ? 4 + (i % 5) : i % 3,
      side === "b" ? 4 + (i % 5) : i % 3,
    );
    finished += 1;
  }

  // Refresh for live candidates (queued with both athletes)
  const { data: after } = await admin
    .from("competition_matches")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("status", "queued")
    .not("athlete_a_id", "is", null)
    .not("athlete_b_id", "is", null)
    .order("mat_number")
    .order("round_index")
    .order("match_index");

  const liveByMat = new Map<number, number>();
  let live = 0;
  for (const m of after ?? []) {
    const mat = m.mat_number || 1;
    const n = liveByMat.get(mat) ?? 0;
    if (n >= opts.livePerMat) continue;
    await admin
      .from("competition_matches")
      .update({
        status: "live",
        score_a: 2,
        score_b: 0,
        advantages_a: 1,
        advantages_b: 0,
        clock_seconds: 280,
        clock_running: true,
        clock_updated_at: new Date().toISOString(),
      })
      .eq("id", m.id);
    liveByMat.set(mat, n + 1);
    live += 1;
  }

  return { finished, live };
}

async function createBulkRoster(
  admin: SupabaseClient,
  academies: { id: string; slug: string }[],
  maleCount: number,
  femaleCount: number,
) {
  const athletes: {
    id: string;
    full_name: string;
    belt: string;
    weight_kg: number;
    gender: "male" | "female";
    academy_id: string;
  }[] = [];

  for (let i = 0; i < maleCount; i++) {
    const academy = academies[i % academies.length]!;
    const belt = pick(BELTS, i);
    const cap = pick(WEIGHT_CAPS, i);
    const weightKg = Math.round((cap - 1.5 - (i % 3) * 0.7) * 10) / 10;
    const name = `${pick(FIRST_M, i)} ${pick(LAST, i * 3)} ${pick(LAST, i + 7)}`;
    const a = await ensureBulkAthlete(admin, {
      academyId: academy.id,
      fullName: name,
      belt,
      weightKg,
      birthDate: birthForAge(18 + (i % 12)),
      gender: "male",
      countryCode: i % 9 === 0 ? "BR" : "PT",
    });
    athletes.push({
      id: a.id,
      full_name: a.full_name,
      belt: a.belt,
      weight_kg: Number(a.weight_kg),
      gender: "male",
      academy_id: academy.id,
    });
  }

  for (let i = 0; i < femaleCount; i++) {
    const academy = academies[i % academies.length]!;
    const belt = pick(BELTS, i + 2);
    const cap = pick(WEIGHT_CAPS.slice(0, 6), i);
    const weightKg = Math.round((cap - 2 - (i % 2)) * 10) / 10;
    const name = `${pick(FIRST_F, i)} ${pick(LAST, i * 2 + 1)} ${pick(LAST, i + 11)}`;
    const a = await ensureBulkAthlete(admin, {
      academyId: academy.id,
      fullName: name,
      belt,
      weightKg,
      birthDate: birthForAge(18 + (i % 11)),
      gender: "female",
      countryCode: i % 7 === 0 ? "BR" : "PT",
    });
    athletes.push({
      id: a.id,
      full_name: a.full_name,
      belt: a.belt,
      weight_kg: Number(a.weight_kg),
      gender: "female",
      academy_id: academy.id,
    });
  }

  return athletes;
}

function groupForBrackets(
  athletes: {
    id: string;
    belt: string;
    weight_kg: number;
    gender: "male" | "female";
  }[],
  gender: "male" | "female",
  belt: string,
  maxKg: number,
  minKg: number,
) {
  return athletes.filter(
    (a) =>
      a.gender === gender &&
      a.belt === belt &&
      a.weight_kg <= maxKg &&
      a.weight_kg > minKg,
  );
}

async function enrollEligible(
  admin: SupabaseClient,
  competitionId: string,
  athletes: {
    id: string;
    belt: string;
    weight_kg: number;
    gender: "male" | "female";
  }[],
  absolutoId: string | null,
) {
  const divisions = await listEntryDivisions(admin, competitionId);
  let entries = 0;

  for (const a of athletes) {
    const div = divisions.find(
      (d) =>
        d.gender === a.gender &&
        d.belt === a.belt &&
        d.weight_max_kg != null &&
        a.weight_kg <= Number(d.weight_max_kg) &&
        (d.weight_min_kg == null || a.weight_kg > Number(d.weight_min_kg)),
    );
    if (div) {
      await ensureEntry(admin, competitionId, a.id, div.id, true);
      entries += 1;
    }
    // ~25% also enter absoluto
    if (absolutoId && (a.id.charCodeAt(0) + a.id.charCodeAt(1)) % 4 === 0) {
      await ensureEntry(admin, competitionId, a.id, absolutoId, true);
      entries += 1;
    }
  }

  // A few unapproved entries for admin UI testing
  const leftovers = athletes.filter((a) => a.belt === "white").slice(0, 3);
  for (const a of leftovers) {
    const div = divisions.find((d) => d.gender === a.gender && d.belt === "white");
    if (div) {
      await ensureEntry(admin, competitionId, a.id, div.id, false);
      entries += 1;
    }
  }

  return entries;
}

async function generateAllReadyBrackets(
  admin: SupabaseClient,
  competitionId: string,
  matsCount: number,
) {
  const { data: entries } = await admin
    .from("competition_entries")
    .select("athlete_id, division_id, approved")
    .eq("competition_id", competitionId)
    .eq("approved", true);

  const byDiv = new Map<string, string[]>();
  for (const e of entries ?? []) {
    if (!e.division_id) continue;
    const list = byDiv.get(e.division_id) ?? [];
    list.push(e.athlete_id);
    byDiv.set(e.division_id, list);
  }

  let brackets = 0;
  let matches = 0;
  let mat = 1;

  for (const [divisionId, ids] of byDiv) {
    const unique = [...new Set(ids)];
    if (unique.length < 2) continue;
    // Cap huge divisions so seed stays reasonable (max 16 for bracket size)
    const sliced = unique.slice(0, 16);
    if (sliced.length < 2) continue;
    const n = await seedGenerateBracket(admin, competitionId, divisionId, sliced, mat);
    matches += n;
    brackets += 1;
    mat = mat >= matsCount ? 1 : mat + 1;
  }

  return { brackets, matches };
}

async function main() {
  const { url, serviceKey } = requireEnv();
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("→ Utilizadores demo (login)…");
  const ids: Record<string, string> = {};
  for (const u of USERS) {
    const { id, created } = await ensureUser(admin, u);
    ids[u.email] = id;
    console.log(`  ${created ? "+" : "="} ${u.email}`);
  }

  console.log("→ Federações…");
  const fedMatcomp = await ensureFederation(admin, {
    name: "MatComp Open",
    slug: "matcomp",
    subdomain: "matcomp",
    website_url: "https://matcomp.app",
    primary_color: "#e11d48",
  });
  const fedNorte = await ensureFederation(admin, {
    name: "Circuito Norte BJJ",
    slug: "norte-bjj",
    subdomain: "norte",
    website_url: "https://example.com/norte",
    primary_color: "#0ea5e9",
  });
  const fedSul = await ensureFederation(admin, {
    name: "Liga Sul BJJ",
    slug: "sul-bjj",
    subdomain: "sul",
    primary_color: "#16a34a",
  });

  console.log("→ Academias…");
  const alien = await ensureAcademy(
    admin,
    {
      name: "Alien Academy",
      slug: "alien-academy",
      city: "Barcelos",
      affiliation: "FPJJ",
      primary_color: "#e11d48",
    },
    ids["organizador@matcomp.demo"],
  );
  const porto = await ensureAcademy(
    admin,
    {
      name: "Porto Grappling",
      slug: "porto-grappling",
      city: "Porto",
      affiliation: "IBJJF",
      primary_color: "#f59e0b",
    },
    ids["coach@matcomp.demo"],
  );
  const lisboa = await ensureAcademy(
    admin,
    {
      name: "Lisboa Fight Club",
      slug: "lisboa-fight-club",
      city: "Lisboa",
      affiliation: "FPJJ",
      primary_color: "#6366f1",
    },
    ids["organizador@matcomp.demo"],
  );
  const braga = await ensureAcademy(
    admin,
    {
      name: "Braga Jiu-Jitsu",
      slug: "braga-jj",
      city: "Braga",
      affiliation: "IBJJF",
      primary_color: "#0891b2",
    },
    ids["coach@matcomp.demo"],
  );

  // Staff membership for referee on Alien
  const { data: refMember } = await admin
    .from("academy_members")
    .select("id")
    .eq("academy_id", alien.id)
    .eq("user_id", ids["referee@matcomp.demo"])
    .maybeSingle();
  if (!refMember) {
    await admin.from("academy_members").insert({
      academy_id: alien.id,
      user_id: ids["referee@matcomp.demo"],
      role: "staff",
    });
  }

  console.log("→ Atletas com conta…");
  const named = [
    await ensureAthleteAccount(admin, {
      academyId: alien.id,
      userId: ids["atleta1@matcomp.demo"],
      fullName: "João Silva",
      belt: "blue",
      weightKg: 76,
      birthDate: "1995-03-20",
      gender: "male",
    }),
    await ensureAthleteAccount(admin, {
      academyId: alien.id,
      userId: ids["atleta2@matcomp.demo"],
      fullName: "Miguel Costa",
      belt: "white",
      weightKg: 70,
      birthDate: "1998-07-15",
      gender: "male",
    }),
    await ensureAthleteAccount(admin, {
      academyId: porto.id,
      userId: ids["atleta3@matcomp.demo"],
      fullName: "Sofia Mendes",
      belt: "purple",
      weightKg: 58,
      birthDate: "1997-11-08",
      gender: "female",
    }),
    await ensureAthleteAccount(admin, {
      academyId: porto.id,
      userId: ids["atleta4@matcomp.demo"],
      fullName: "Pedro Alves",
      belt: "blue",
      weightKg: 82,
      birthDate: "2000-01-30",
      gender: "male",
      countryCode: "BR",
    }),
    await ensureAthleteAccount(admin, {
      academyId: alien.id,
      userId: ids["atleta5@matcomp.demo"],
      fullName: "Tiago Rocha",
      belt: "blue",
      weightKg: 74,
      birthDate: "1996-06-12",
      gender: "male",
    }),
    await ensureAthleteAccount(admin, {
      academyId: alien.id,
      userId: ids["atleta6@matcomp.demo"],
      fullName: "Bruno Dias",
      belt: "blue",
      weightKg: 75,
      birthDate: "1994-02-28",
      gender: "male",
    }),
    await ensureAthleteAccount(admin, {
      academyId: alien.id,
      userId: ids["atleta7@matcomp.demo"],
      fullName: "Inês Ferreira",
      belt: "blue",
      weightKg: 58,
      birthDate: "1999-08-19",
      gender: "female",
    }),
    await ensureAthleteAccount(admin, {
      academyId: lisboa.id,
      userId: ids["atleta8@matcomp.demo"],
      fullName: "Rui Martins",
      belt: "purple",
      weightKg: 88,
      birthDate: "2001-12-03",
      gender: "male",
    }),
  ];

  console.log("→ Pedido de adesão pendente…");
  const { data: pendingReq } = await admin
    .from("academy_join_requests")
    .select("id")
    .eq("user_id", ids["pendente@matcomp.demo"])
    .eq("academy_id", alien.id)
    .eq("status", "pending")
    .maybeSingle();
  if (!pendingReq) {
    const { error } = await admin.from("academy_join_requests").insert({
      user_id: ids["pendente@matcomp.demo"],
      academy_id: alien.id,
      status: "pending",
      message: "Quero treinar e competir — seed demo",
    });
    if (error && !error.message.includes("duplicate")) throw error;
  }

  console.log("→ Roster em massa (sem login)…");
  const bulk = await createBulkRoster(
    admin,
    [alien, porto, lisboa, braga],
    80,
    40,
  );
  console.log(`  = ${bulk.length} atletas roster (+ ${named.length} com conta)`);

  const allAthletes = [
    ...named.map((a) => ({
      id: a.id,
      full_name: a.full_name,
      belt: a.belt as string,
      weight_kg: Number(a.weight_kg),
      gender: (a.full_name === "Sofia Mendes" || a.full_name === "Inês Ferreira"
        ? "female"
        : "male") as "male" | "female",
      academy_id: a.academy_id,
    })),
    ...bulk,
  ];

  // ─── Event 1: LIVE mega event (Barcelos) ───
  console.log("→ Evento LIVE — Barcelos OPEN…");
  const liveEvent = await ensureCompetition(admin, {
    academyId: alien.id,
    createdBy: ids["organizador@matcomp.demo"],
    federationId: fedMatcomp.id,
    name: "Barcelos OPEN (Demo Live)",
    slug: "barcelos-open-demo",
    status: "live",
    venue: "Pavilhão Municipal — Barcelos",
    mapQuery: "Barcelos, Portugal",
    matsCount: 4,
    startsOffsetDays: 0,
    contactEmail: "organizador@matcomp.demo",
  });
  await ensureIbjjfGroup(admin, liveEvent.id, "male", 3500);
  await ensureIbjjfGroup(admin, liveEvent.id, "female", 3500);
  const liveAbs = await ensureAbsoluteDivision(admin, liveEvent.id);

  // Wipe previous seed matches so re-seed rebuilds brackets
  await admin.from("competition_matches").delete().eq("competition_id", liveEvent.id);

  const liveEntries = await enrollEligible(admin, liveEvent.id, allAthletes, liveAbs.id);
  console.log(`  = ${liveEntries} inscrições`);

  // Pack dense brackets across belts/weights so mesas have many fights
  console.log("  → A densificar chaves (16 atletas / divisão)…");
  const liveDivs = await listEntryDivisions(admin, liveEvent.id);
  const packTargets: { gender: "male" | "female"; belt: string; maxKg: number }[] = [
    { gender: "male", belt: "white", maxKg: 70 },
    { gender: "male", belt: "white", maxKg: 76 },
    { gender: "male", belt: "blue", maxKg: 70 },
    { gender: "male", belt: "blue", maxKg: 76 },
    { gender: "male", belt: "blue", maxKg: 82.3 },
    { gender: "male", belt: "purple", maxKg: 76 },
    { gender: "male", belt: "purple", maxKg: 88.3 },
    { gender: "male", belt: "brown", maxKg: 82.3 },
    { gender: "male", belt: "black", maxKg: 88.3 },
    { gender: "female", belt: "white", maxKg: 64 },
    { gender: "female", belt: "blue", maxKg: 64 },
    { gender: "female", belt: "blue", maxKg: 70 },
    { gender: "female", belt: "purple", maxKg: 64 },
  ];

  // Temporary reassignment: move bulk athletes into packed divisions by rewriting weight/belt
  let packIdx = 0;
  for (const target of packTargets) {
    const div = liveDivs.find(
      (d) =>
        d.gender === target.gender &&
        d.belt === target.belt &&
        Number(d.weight_max_kg) === target.maxKg,
    );
    if (!div) continue;
    const pool = allAthletes.filter((a) => a.gender === target.gender).slice(packIdx, packIdx + 16);
    packIdx += 12;
    for (const a of pool) {
      // Align athlete meta so eligibility UI stays consistent
      await admin
        .from("athletes")
        .update({
          belt: target.belt,
          weight_kg: target.maxKg - 1.2,
        })
        .eq("id", a.id);
      a.belt = target.belt;
      a.weight_kg = target.maxKg - 1.2;
      await ensureEntry(admin, liveEvent.id, a.id, div.id, true);
    }
  }

  // Big absoluto open bracket (up to 16)
  for (const a of allAthletes.slice(0, 16)) {
    await ensureEntry(admin, liveEvent.id, a.id, liveAbs.id, true);
  }

  const { brackets, matches } = await generateAllReadyBrackets(admin, liveEvent.id, 4);
  console.log(`  = ${brackets} chaves · ${matches} lutas geradas`);

  const progress = await simulateBracketProgress(admin, liveEvent.id, {
    finishRound0Ratio: 0.55,
    livePerMat: 1,
  });
  console.log(`  = progresso: ${progress.finished} terminadas · ${progress.live} ao vivo`);

  // ─── Event 2: REGISTRATION (Porto) ───
  console.log("→ Evento REGISTRATION — Porto Challenge…");
  const regEvent = await ensureCompetition(admin, {
    academyId: porto.id,
    createdBy: ids["coach@matcomp.demo"],
    federationId: fedNorte.id,
    name: "Porto Challenge (Demo)",
    slug: "porto-challenge-demo",
    status: "registration",
    venue: "Dragão Arena — Porto",
    mapQuery: "Porto, Portugal",
    matsCount: 3,
    startsOffsetDays: 28,
    contactEmail: "coach@matcomp.demo",
  });
  await ensureIbjjfGroup(admin, regEvent.id, "male", 4000, ["white", "blue", "purple"]);
  await ensureIbjjfGroup(admin, regEvent.id, "female", 4000, ["white", "blue", "purple"]);
  const regAbs = await ensureAbsoluteDivision(admin, regEvent.id);
  await admin.from("competition_matches").delete().eq("competition_id", regEvent.id);
  const regEntries = await enrollEligible(
    admin,
    regEvent.id,
    allAthletes.slice(0, 70),
    regAbs.id,
  );
  console.log(`  = ${regEntries} inscrições (sem chaves)`);

  // ─── Event 3: FINISHED (Lisboa) ───
  console.log("→ Evento FINISHED — Lisboa Winter…");
  const finEvent = await ensureCompetition(admin, {
    academyId: lisboa.id,
    createdBy: ids["organizador@matcomp.demo"],
    federationId: fedSul.id,
    name: "Lisboa Winter Cup (Demo)",
    slug: "lisboa-winter-demo",
    status: "finished",
    venue: "MEO Arena — Lisboa",
    mapQuery: "Lisboa, Portugal",
    matsCount: 2,
    startsOffsetDays: -45,
    contactEmail: "organizador@matcomp.demo",
  });
  await ensureIbjjfGroup(admin, finEvent.id, "male", 3000, ["blue", "purple"]);
  await ensureIbjjfGroup(admin, finEvent.id, "female", 3000, ["blue", "purple"]);
  const finAbs = await ensureAbsoluteDivision(admin, finEvent.id, "Absoluto Winter");
  await admin.from("competition_matches").delete().eq("competition_id", finEvent.id);
  // Dense finished brackets
  const finDivs = await listEntryDivisions(admin, finEvent.id);
  const finPack = [
    { gender: "male" as const, belt: "blue", maxKg: 76 },
    { gender: "male" as const, belt: "purple", maxKg: 82.3 },
    { gender: "female" as const, belt: "blue", maxKg: 64 },
  ];
  let finIdx = 20;
  for (const target of finPack) {
    const div = finDivs.find(
      (d) =>
        d.gender === target.gender &&
        d.belt === target.belt &&
        Number(d.weight_max_kg) === target.maxKg,
    );
    if (!div) continue;
    const pool = allAthletes.filter((a) => a.gender === target.gender).slice(finIdx, finIdx + 16);
    finIdx += 16;
    for (const a of pool) {
      await admin
        .from("athletes")
        .update({ belt: target.belt, weight_kg: target.maxKg - 1 })
        .eq("id", a.id);
      await ensureEntry(admin, finEvent.id, a.id, div.id, true);
    }
  }
  for (const a of allAthletes.slice(50, 66)) {
    await ensureEntry(admin, finEvent.id, a.id, finAbs.id, true);
  }
  const finBrackets = await generateAllReadyBrackets(admin, finEvent.id, 2);
  await simulateBracketProgress(admin, finEvent.id, {
    finishRound0Ratio: 1,
    livePerMat: 0,
  });
  // Finish remaining queued with athletes
  const { data: stillQueued } = await admin
    .from("competition_matches")
    .select("*")
    .eq("competition_id", finEvent.id)
    .eq("status", "queued")
    .not("athlete_a_id", "is", null)
    .not("athlete_b_id", "is", null);
  for (let i = 0; i < (stillQueued?.length ?? 0); i++) {
    const m = stillQueued![i]!;
    await finishMatch(admin, m, i % 2 === 0 ? "a" : "b", pick(WIN_METHODS, i + 3), 6, 2);
  }
  console.log(`  = ${finBrackets.brackets} chaves · ${finBrackets.matches} lutas (evento fechado)`);

  // ─── Event 4: DRAFT ───
  console.log("→ Evento DRAFT — Braga…");
  const draftEvent = await ensureCompetition(admin, {
    academyId: braga.id,
    createdBy: ids["coach@matcomp.demo"],
    federationId: null,
    name: "Braga Open (Rascunho)",
    slug: "braga-draft-demo",
    status: "draft",
    venue: "Pavilhão Altice — Braga",
    mapQuery: "Braga, Portugal",
    matsCount: 2,
    startsOffsetDays: 60,
    contactEmail: "coach@matcomp.demo",
  });
  await ensureAbsoluteDivision(admin, draftEvent.id);

  const { count: matchCount } = await admin
    .from("competition_matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", liveEvent.id);

  const blueLight = groupForBrackets(allAthletes, "male", "blue", 76, 70);

  console.log(`
✓ Seed rico concluído.

Contas (password: ${DEMO_PASSWORD})
────────────────────────────────────
organizador@matcomp.demo   Alien + Lisboa + Barcelos LIVE
coach@matcomp.demo         Porto + Braga
referee@matcomp.demo       staff Alien
atleta1…8@matcomp.demo     atletas com conta
pendente@matcomp.demo      pedido pendente Alien

Dados
─────
Academias: 4 · Federações: 3 · Roster: ~${allAthletes.length} atletas
Barcelos LIVE: 4 tatâmis · ~${matchCount} lutas · chaves mistas (finished/live/queued)
Porto: registration · só inscrições
Lisboa: finished · chaves concluídas
Braga: draft

URLs
────
/pt/event/${liveEvent.id}
/mesa/${liveEvent.id}
/mesa/${liveEvent.id}/1   … /4
/display/mat/${liveEvent.id}/1
/tv/${liveEvent.id}
/pt/event/${regEvent.id}
/pt/event/${finEvent.id}
/f/matcomp  /f/norte-bjj  /f/sul-bjj

Dica mesa: blue/-76 tem ~${blueLight.length} atletas elegíveis para chaves densas.
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
