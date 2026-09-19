import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StudentPhoto } from "@/components/StudentPhoto";
import { uploadStudentPhoto } from "@/lib/student-photo";

type Props = {
  profileId: string;
  currentPath?: string | null;
  name?: string | null;
  onUpdated?: (path: string) => void;
};

export function StudentPhotoUpload({ profileId, currentPath, name, onUpdated }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localPath, setLocalPath] = useState(currentPath ?? null);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const path = await uploadStudentPhoto(profileId, file);
      setLocalPath(path);
      setPreviewUrl(URL.createObjectURL(file));
      onUpdated?.(path);
      qc.invalidateQueries({ queryKey: ["student-photo", path] });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["account-profile"] });
      toast.success("Foto 3×4 guardada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar foto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <StudentPhoto path={localPath} previewUrl={previewUrl} name={name} size="lg" />
      <div className="flex-1 space-y-2 text-center sm:text-left">
        <div>
          <Label className="text-sm font-medium">Foto 3×4</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Formato tipo documento. JPG ou PNG, máx. 5 MB.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Camera className="h-4 w-4 mr-2" />
          )}
          {localPath || previewUrl ? "Alterar foto" : "Adicionar foto"}
        </Button>
      </div>
    </div>
  );
}
