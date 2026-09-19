import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function EditPhoneField({
  profileId,
  phone,
  onSaved,
}: {
  profileId: string;
  phone?: string | null;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(phone ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ phone: value.trim() || null } as never)
      .eq("id", profileId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Telefone atualizado.");
    onSaved();
  };

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
      <Label htmlFor="edit-phone">Telefone de contacto</Label>
      <div className="flex gap-2">
        <Input
          id="edit-phone"
          type="tel"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="+351 9xx xxx xxx"
        />
        <Button onClick={save} disabled={busy} variant="outline" className="shrink-0">
          {busy ? "…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
