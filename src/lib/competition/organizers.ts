import { supabase } from "@/integrations/supabase/client";
import { slugify } from "./types";

export type OrganizerMemberRole = "owner" | "admin" | "staff";

export type Organizer = {
  id: string;
  name: string;
  slug: string;
  organization_code: string;
  contact_email?: string | null;
  billing_email?: string | null;
  logo_url?: string | null;
  created_by?: string | null;
  created_at?: string;
  legal_name?: string | null;
  description?: string | null;
  website_url?: string | null;
  country?: string | null;
  billing_name?: string | null;
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_postal?: string | null;
  billing_country?: string | null;
  vat_number?: string | null;
  phone?: string | null;
  agreements_accepted_at?: string | null;
  credits_balance?: number;
  auto_refill?: boolean;
  stripe_publishable_key?: string | null;
  stripe_secret_key_ref?: string | null;
  custom_payment_instructions?: string | null;
  is_public?: boolean;
  status?: "pending" | "active" | "suspended";
};

export type OrganizerMember = {
  id: string;
  organizer_id: string;
  user_id: string;
  role: OrganizerMemberRole;
};

export type OrganizerCreditRow = {
  id: string;
  organizer_id: string;
  delta: number;
  reason: string;
  competition_id?: string | null;
  created_at: string;
};

export type CreateOrganizerInput = {
  name: string;
  legal_name?: string | null;
  description?: string | null;
  website_url?: string | null;
  country?: string | null;
  phone?: string | null;
  contact_email?: string | null;
  billing_email?: string | null;
  billing_name: string;
  billing_address_line1: string;
  billing_address_line2?: string | null;
  billing_city: string;
  billing_postal?: string | null;
  billing_country: string;
  vat_number?: string | null;
  acceptAgreements: boolean;
};

export async function fetchMyOrganizers() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [] as Organizer[];

  const { data: memberships, error } = await supabase
    .from("organizer_members")
    .select("organizer_id, role, organizers(*)")
    .eq("user_id", user.id);
  if (error) throw error;

  return (memberships ?? [])
    .map((m: any) => m.organizers as Organizer | null)
    .filter(Boolean) as Organizer[];
}

export async function fetchOrganizerBySlug(slug: string) {
  const { data, error } = await supabase
    .from("organizers")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as Organizer | null;
}

export async function fetchOrganizer(id: string) {
  const { data, error } = await supabase.from("organizers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Organizer | null;
}

export async function fetchPublicOrganizerBySlug(slug: string) {
  const org = await fetchOrganizerBySlug(slug);
  if (!org || org.is_public === false) return null;
  // Never expose billing / payment secrets on the public page
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    organization_code: org.organization_code,
    description: org.description,
    website_url: org.website_url,
    country: org.country,
    contact_email: org.contact_email,
    logo_url: org.logo_url,
    is_public: org.is_public,
    status: org.status,
  } as Organizer;
}

export async function createOrganizer(input: CreateOrganizerInput) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Precisas de sessão.");
  if (!input.acceptAgreements) {
    throw new Error("Tens de aceitar os termos da MatComp.");
  }
  if (!input.billing_name.trim() || !input.billing_address_line1.trim() || !input.billing_city.trim()) {
    throw new Error("Preenche os dados de faturação (nome, morada e cidade).");
  }

  const base = slugify(input.name) || `org-${Date.now().toString(36)}`;
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from("organizers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 5)}`;
  }

  const { data: org, error } = await supabase
    .from("organizers")
    .insert({
      name: input.name.trim(),
      slug,
      created_by: user.id,
      legal_name: input.legal_name?.trim() || input.name.trim(),
      description: input.description?.trim() || null,
      website_url: input.website_url?.trim() || null,
      country: input.country?.trim() || input.billing_country.trim(),
      phone: input.phone?.trim() || null,
      contact_email: input.contact_email?.trim() || user.email || null,
      billing_email: input.billing_email?.trim() || user.email || null,
      billing_name: input.billing_name.trim(),
      billing_address_line1: input.billing_address_line1.trim(),
      billing_address_line2: input.billing_address_line2?.trim() || null,
      billing_city: input.billing_city.trim(),
      billing_postal: input.billing_postal?.trim() || null,
      billing_country: input.billing_country.trim(),
      vat_number: input.vat_number?.trim() || null,
      agreements_accepted_at: new Date().toISOString(),
      credits_balance: 20,
      status: "active",
      is_public: true,
    } as never)
    .select("*")
    .single();
  if (error) throw error;

  const { error: memErr } = await supabase.from("organizer_members").insert({
    organizer_id: org.id,
    user_id: user.id,
    role: "owner",
  } as never);
  if (memErr) throw memErr;

  await supabase.from("organizer_credit_ledger").insert({
    organizer_id: org.id,
    delta: 20,
    reason: "welcome_gift",
    created_by: user.id,
  } as never);

  return org as Organizer;
}

export type OrganizerUpdate = Partial<
  Omit<Organizer, "id" | "slug" | "organization_code" | "created_by" | "created_at" | "credits_balance">
>;

export async function updateOrganizer(organizerId: string, patch: OrganizerUpdate) {
  const { data, error } = await supabase
    .from("organizers")
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", organizerId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Organizer;
}

export async function isOrganizerMember(organizerId: string) {
  const { data, error } = await supabase.rpc("is_organizer_member", {
    _organizer_id: organizerId,
  });
  if (error) return false;
  return !!data;
}

export async function canManageOrganizer(organizerId: string) {
  const { data, error } = await supabase.rpc("can_manage_organizer", {
    _organizer_id: organizerId,
  });
  if (error) return false;
  return !!data;
}

export async function fetchOrganizerMembers(organizerId: string) {
  const { data, error } = await supabase
    .from("organizer_members")
    .select("*")
    .eq("organizer_id", organizerId);
  if (error) throw error;
  return (data ?? []) as OrganizerMember[];
}

export async function addOrganizerMemberByEmail(
  organizerId: string,
  email: string,
  role: OrganizerMemberRole = "staff",
) {
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("user_id, email, full_name")
    .ilike("email", email.trim())
    .maybeSingle();
  if (pErr) throw pErr;
  if (!profile?.user_id) {
    throw new Error("Não existe conta MatComp com esse email. A pessoa tem de se registar primeiro.");
  }

  const { data, error } = await supabase
    .from("organizer_members")
    .upsert(
      {
        organizer_id: organizerId,
        user_id: profile.user_id,
        role,
      } as never,
      { onConflict: "organizer_id,user_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return { member: data as OrganizerMember, profile };
}

export async function updateOrganizerMemberRole(
  memberId: string,
  role: OrganizerMemberRole,
) {
  const { data, error } = await supabase
    .from("organizer_members")
    .update({ role } as never)
    .eq("id", memberId)
    .select("*")
    .single();
  if (error) throw error;
  return data as OrganizerMember;
}

export async function removeOrganizerMember(memberId: string) {
  const { error } = await supabase.from("organizer_members").delete().eq("id", memberId);
  if (error) throw error;
}

export async function fetchOrganizerCreditLedger(organizerId: string) {
  const { data, error } = await supabase
    .from("organizer_credit_ledger")
    .select("*")
    .eq("organizer_id", organizerId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as OrganizerCreditRow[];
}

/** Demo: buy credits pack without Stripe (ledger only). */
export async function purchaseOrganizerCredits(organizerId: string, amount: number) {
  if (amount <= 0) throw new Error("Quantidade inválida");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: org, error: oErr } = await supabase
    .from("organizers")
    .select("credits_balance")
    .eq("id", organizerId)
    .single();
  if (oErr) throw oErr;

  const next = (org.credits_balance ?? 0) + amount;
  const { error: uErr } = await supabase
    .from("organizers")
    .update({ credits_balance: next } as never)
    .eq("id", organizerId);
  if (uErr) throw uErr;

  await supabase.from("organizer_credit_ledger").insert({
    organizer_id: organizerId,
    delta: amount,
    reason: `purchase_${amount}`,
    created_by: user?.id ?? null,
  } as never);

  return next;
}

export async function connectOrganizerByCode(federationId: string, organizationCode: string) {
  const { data, error } = await supabase.rpc("connect_organizer_by_code", {
    _federation_id: federationId,
    _organization_code: organizationCode,
  });
  if (error) throw error;
  return data;
}

export async function fetchFederationOrganizers(federationId: string) {
  const { data, error } = await supabase
    .from("federation_organizers")
    .select("*, organizers(*)")
    .eq("federation_id", federationId)
    .eq("approved", true);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    organizer: row.organizers as Organizer,
  }));
}

export async function fetchOrganizerFederations(organizerId: string) {
  const { data, error } = await supabase
    .from("federation_organizers")
    .select("*, federations(*)")
    .eq("organizer_id", organizerId)
    .eq("approved", true);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    federation: row.federations,
  }));
}

export async function fetchOrganizerEvents(organizerId: string) {
  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .eq("organizer_id", organizerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
