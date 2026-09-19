import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import process from "node:process";

export type EmailType =
  | "entry_confirmed"
  | "entry_approved"
  | "event_reminder"
  | "queue_call";

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function subjectFor(type: EmailType, competitionName?: string) {
  const name = competitionName ?? "MatComp";
  switch (type) {
    case "entry_confirmed":
      return `Inscrição confirmada — ${name}`;
    case "entry_approved":
      return `Inscrição aprovada — ${name}`;
    case "event_reminder":
      return `Lembrete: ${name}`;
    case "queue_call":
      return `Chamada — ${name}`;
  }
}

function bodyFor(type: EmailType, payload: Record<string, unknown>) {
  const name = String(payload.competitionName ?? "evento");
  const athlete = String(payload.athleteName ?? "Atleta");
  switch (type) {
    case "entry_confirmed":
      return `Olá ${athlete},\n\nA tua inscrição em ${name} foi registada.\n\n— MatComp`;
    case "entry_approved":
      return `Olá ${athlete},\n\nA tua inscrição em ${name} foi aprovada. Bom torneio!\n\n— MatComp`;
    case "event_reminder":
      return `Olá ${athlete},\n\nLembrete: ${name} aproxima-se (${payload.startsAt ?? ""}).\n\n— MatComp`;
    case "queue_call": {
      const phase = String(payload.phase ?? "mat");
      const where =
        phase === "warmup"
          ? "área de aquecimento"
          : phase === "weigh_in"
            ? "área de pesagem"
            : phase === "podium"
              ? "área de pódio"
              : `tatâmi ${payload.mat ?? "?"}`;
      return `Olá ${athlete},\n\nFoste chamado(a) para a ${where} (${name}).\n\n— MatComp`;
    }
  }
}

async function sendViaResend(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false as const, error: "skipped_no_key" };

  const from = process.env.RESEND_FROM?.trim() || "MatComp <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) {
    const err = await res.text();
    return { ok: false as const, error: err.slice(0, 500) };
  }
  return { ok: true as const, error: null };
}

async function deliver(opts: {
  type: EmailType;
  toEmail: string;
  competitionId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const payload = opts.payload ?? {};
  const subject = subjectFor(opts.type, payload.competitionName as string | undefined);
  const text = bodyFor(opts.type, payload);
  const result = await sendViaResend(opts.toEmail, subject, text);

  const admin = adminClient();
  if (admin) {
    await admin.from("email_outbox").insert({
      email_type: opts.type,
      to_email: opts.toEmail,
      subject,
      payload: { ...payload, text },
      competition_id: opts.competitionId ?? null,
      sent_at: result.ok ? new Date().toISOString() : null,
      error: result.error,
    });
  } else {
    console.info("[email]", opts.type, opts.toEmail, result.error ?? "sent");
  }
  return { sent: result.ok, error: result.error };
}

export const queueAndSendEmail = createServerFn({ method: "POST" })
  .validator(
    (data: {
      type: EmailType;
      toEmail: string;
      competitionId?: string | null;
      payload?: Record<string, unknown>;
    }) => data,
  )
  .handler(async ({ data }) => deliver(data));

export const sendEventReminders = createServerFn({ method: "POST" })
  .validator((data: { competitionId: string }) => data)
  .handler(async ({ data }) => {
    const admin = adminClient();
    if (!admin) return { sent: 0, error: "no_service_role" as string | null };

    const { data: comp } = await admin
      .from("competitions")
      .select("id, name, starts_at")
      .eq("id", data.competitionId)
      .single();
    if (!comp) return { sent: 0, error: "not_found" as string | null };

    const { data: entries } = await admin
      .from("competition_entries")
      .select("id, athlete:athletes(full_name, user_id)")
      .eq("competition_id", data.competitionId)
      .eq("approved", true);

    let sent = 0;
    for (const e of entries ?? []) {
      const ath = e.athlete as { full_name?: string; user_id?: string } | null;
      if (!ath?.user_id) continue;
      const { data: profile } = await admin
        .from("profiles")
        .select("email")
        .eq("user_id", ath.user_id)
        .maybeSingle();
      if (!profile?.email) continue;

      const r = await deliver({
        type: "event_reminder",
        toEmail: profile.email,
        competitionId: data.competitionId,
        payload: {
          competitionName: comp.name,
          athleteName: ath.full_name,
          startsAt: comp.starts_at,
        },
      });
      if (r.sent || r.error === "skipped_no_key") sent += 1;
    }
    return { sent, error: null as string | null };
  });
