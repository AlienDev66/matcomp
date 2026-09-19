import { supabase } from "@/integrations/supabase/client";

const BUCKET = "event-covers";
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function validateEventCover(file: File): string | null {
  if (!ACCEPT.includes(file.type)) return "Usa JPG, PNG ou WebP.";
  if (file.size > MAX_BYTES) return "Máximo 5 MB.";
  return null;
}

/** Upload cover to public bucket; returns public URL. */
export async function uploadEventCover(competitionId: string, file: File): Promise<string> {
  const err = validateEventCover(file);
  if (err) throw new Error(err);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${competitionId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
