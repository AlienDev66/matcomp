import { useRef, useState } from "react";
import { Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StudentPhoto } from "@/components/StudentPhoto";
import { validateStudentPhoto } from "@/lib/student-photo";
import { toast } from "sonner";

type Props = {
  file: File | null;
  onChange: (file: File | null) => void;
  name?: string;
};

export function StudentPhotoPicker({ file, onChange, name }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const pick = (next: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!next) {
      setPreviewUrl(null);
      onChange(null);
      return;
    }
    const err = validateStudentPhoto(next);
    if (err) return toast.error(err);
    setPreviewUrl(URL.createObjectURL(next));
    onChange(next);
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card/30 p-3">
      <StudentPhoto previewUrl={previewUrl} name={name} size="md" />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <Label className="text-sm">Foto 3×4 (opcional)</Label>
          <p className="text-xs text-muted-foreground">Podes adicionar agora ou depois na edição.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Camera className="h-4 w-4 mr-1" />
            {file ? "Trocar" : "Escolher"}
          </Button>
          {file && (
            <Button type="button" variant="ghost" size="sm" onClick={() => pick(null)}>
              Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
