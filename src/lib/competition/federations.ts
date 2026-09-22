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

/** Apex domains that host federation subdomains (dbjj.matcomp.com). */
const FEDERATION_ROOTS = new Set(["matcomp.com", "matcomp.app"]);

/** Subdomains that are the main app, never a federation portal. */
const APP_SUBDOMAINS = new Set([
  "www",
  "app",
  "beta",
  "staging",
  "api",
]);

/**
 * Detect federation slug from host: dbjj.matcomp.com → "dbjj".
 * Preview hosts (*.vercel.app) and localhost never map to a federation.
 */
export function federationSlugFromHost(hostname: string): string | null {
  const host = hostname.toLowerCase().split(":")[0] ?? "";
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  if (host.endsWith(".vercel.app") || host === "vercel.app") return null;

  const parts = host.split(".").filter(Boolean);
  if (parts.length < 3) return null;

  const root = parts.slice(-2).join(".");
  if (!FEDERATION_ROOTS.has(root)) return null;

  const sub = parts[0];
  if (!sub || APP_SUBDOMAINS.has(sub)) return null;
  return sub;
}
