import { supabase } from "@/integrations/supabase/client";
import type { Competition, Federation } from "./types";

export async function fetchFederations() {
  const { data, error } = await supabase.from("federations").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Federation[];
}

export async function fetchFederationBySlug(slug: string) {
  const { data, error } = await supabase
    .from("federations")
    .select("*")
    .or(`slug.eq.${slug},subdomain.eq.${slug}`)
    .maybeSingle();
  if (error) throw error;
  return data as Federation | null;
}

export async function fetchFederationEvents(federationId: string) {
  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .eq("federation_id", federationId)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Competition[];
}

/** Detect federation slug from host: dbjj.matcomp.com or localhost with ?fed= */
export function federationSlugFromHost(hostname: string): string | null {
  const host = hostname.toLowerCase().split(":")[0];
  if (host === "localhost" || host === "127.0.0.1") return null;
  const parts = host.split(".");
  // *.matcomp.com or *.matcomp.app
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub && sub !== "www" && sub !== "app") return sub;
  }
  return null;
}
