/**
 * RLS / security smoke expectations (documented as executable checklist).
 * Full E2E against a live Supabase project is still manual — see README.
 */
import { describe, expect, test } from "bun:test";

const RLS_CHECKLIST = [
  "competition_matches: public SELECT; writes via managers or mesa_* RPC + valid token",
  "event_staff: managers ALL; resolve_mesa_token ignores expired/inactive",
  "email_outbox: managers only (no public SELECT of PII)",
  "competition_entries: athletes self-register; weigh-in via managers",
  "federation_admins: only listed admins mutate federation_approval",
  "SUPABASE_SERVICE_ROLE_KEY never in VITE_ / client bundle",
  "Stripe webhook verifies signature before mark-paid",
] as const;

describe("RLS hardening checklist", () => {
  test("checklist is non-empty and covers webhook + tokens", () => {
    expect(RLS_CHECKLIST.length).toBeGreaterThanOrEqual(5);
    expect(RLS_CHECKLIST.some((s) => s.includes("Stripe webhook"))).toBe(true);
    expect(RLS_CHECKLIST.some((s) => s.includes("expire"))).toBe(true);
  });
});
