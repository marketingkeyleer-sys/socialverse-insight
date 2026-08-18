import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type UploadedMedia = { url: string; path: string; type: "image" | "video" };

const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
];

function mediaTypeOf(mime: string): "image" | "video" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return null;
}

export function MediaUploader({
  value,
  onChange,
}: {
  value: UploadedMedia | null;
  onChange: (media: UploadedMedia | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    const type = mediaTypeOf(file.type);
    if (!type || !ACCEPTED_MIME.includes(file.type)) {
      setError("Unsupported file type. Use JPEG, PNG, WEBP, GIF, MP4, or MOV.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const ext = file.name.split(".").pop() || (type === "image" ? "jpg" : "mp4");
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage.from("post-media").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadErr) throw uploadErr;

      const { data: publicUrl } = supabase.storage.from("post-media").getPublicUrl(path);
      onChange({ url: publicUrl.publicUrl, path, type });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex min-w-0 items-center gap-3">
          {value.type === "image" ? (
            <img src={value.url} alt="" className="h-14 w-14 rounded-lg object-cover" />
          ) : (
            <video src={value.url} className="h-14 w-14 rounded-lg object-cover" muted />
          )}
          <div className="min-w-0 text-xs text-muted-foreground">
            {value.type === "image" ? "Image" : "Video"} attached
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center text-xs transition",
          dragOver ? "border-primary bg-primary/5" : "border-white/15 hover:bg-white/[0.03]",
        )}
      >
        {uploading ? (
          <span className="text-muted-foreground">Uploading…</span>
        ) : (
          <>
            <span className="text-foreground">Drop an image or video, or click to browse</span>
            <span className="mt-1 text-muted-foreground">
              JPEG, PNG, WEBP, GIF, MP4, MOV — up to 500MB
            </span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
    </div>
  );
}
