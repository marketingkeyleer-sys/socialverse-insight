import { useEffect, useRef, useState } from "react";
import { Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"];

export function MediaUploader({ urls, onChange, onUploadingChange }: { urls: string[]; onChange: (urls: string[]) => void; onUploadingChange?: (busy: boolean) => void }) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const busyRef = useRef(false);
  const latest = useRef({ urls, onChange, onUploadingChange });
  useEffect(() => { latest.current = { urls, onChange, onUploadingChange }; }, [urls, onChange, onUploadingChange]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!user || busyRef.current) return;
    const list = Array.from(files).filter((f) => ACCEPTED.includes(f.type));
    if (list.length === 0) {
      toast.error("Unsupported file type. Use JPEG, PNG, WEBP, GIF, MP4, or MOV.");
      return;
    }
    if (list.length > 20 || list.some(file => file.size > 50 * 1024 * 1024)) { toast.error("Choose up to 20 files at once, each under 50 MB."); return; }

    busyRef.current = true;
    setUploading(true);
    onUploadingChange?.(true);
    setProgress({ done: 0, total: list.length });
    try {
      const uploaded: string[] = [];
      let failed = 0;
      for (let offset = 0; offset < list.length; offset += 3) {
        const results = await Promise.allSettled(list.slice(offset, offset + 3).map(async file => {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("sv-media").upload(path, file, { contentType: file.type });
        if (error) throw error;
        const { data } = supabase.storage.from("sv-media").getPublicUrl(path);
        setProgress(previous => ({ ...previous, done: previous.done + 1 }));
        return data.publicUrl;
        }));
        for (const result of results) { if (result.status === "fulfilled") uploaded.push(result.value); else failed++; }
      }
      latest.current.onChange([...latest.current.urls, ...uploaded]);
      if (failed) toast.error(`${failed} file(s) could not upload. Successful attachments were kept; retry the missing files.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      busyRef.current = false;
      latest.current.onUploadingChange?.(false);
    }
  };

  const isVideo = (url: string) => /\.(mp4|mov)$/i.test(url);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-6 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "hover:bg-accent",
        )}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <UploadCloud className="h-6 w-6 text-muted-foreground" />
        )}
        <p role={uploading ? "status" : undefined} className="text-sm font-medium">{uploading ? `Uploading ${progress.done}/${progress.total}…` : "Drop images or videos, or click to browse"}</p>
        <p className="text-xs text-muted-foreground">JPEG, PNG, WEBP, GIF, MP4, MOV</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {urls.map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border">
              {isVideo(url) ? (
                <video src={url} className="h-full w-full object-cover" muted />
              ) : (
                <img src={url} alt="" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => onChange(urls.filter((u) => u !== url))}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
