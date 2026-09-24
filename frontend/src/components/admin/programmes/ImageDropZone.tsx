import { mediaUrl } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";
import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { PRESET_IMAGES } from "./constants";

export function ImageDropZone({
  imageUrl,
  uploading,
  onFile,
  onUrl
}: {
  imageUrl: string;
  uploading: boolean;
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) onFile(file);
    },
    [onFile]
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  const preview = imageUrl ? mediaUrl(imageUrl) : null;

  return (
    <div className="space-y-3">
      {/* Drag & Drop Zone */}
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-200",
          dragging ? "border-brand bg-brand/5 scale-[1.01]" : "border-line bg-slate-50 hover:border-brand/50 hover:bg-brand/5"
        )}
        style={{ minHeight: 140 }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        {preview ? (
          <img
            src={preview}
            alt="Aperçu"
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : null}
        <div className={cn(
          "relative z-10 flex flex-col items-center justify-center gap-2 p-6 text-center",
          preview ? "bg-black/50 min-h-[140px]" : ""
        )}>
          {uploading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-brand" />
          ) : (
            <>
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full",
                preview ? "bg-white/20" : "bg-brand/10"
              )}>
                <Upload className={cn("h-5 w-5", preview ? "text-white" : "text-brand")} />
              </div>
              <p className={cn("text-xs font-semibold", preview ? "text-white" : "text-muted")}>
                {dragging ? "Relâchez pour uploader" : preview ? "Cliquez ou déposez une nouvelle image" : "Glissez-déposez une image ici"}
              </p>
              {!preview && (
                <p className="text-[11px] text-muted">PNG, JPG, WEBP — max 5 Mo</p>
              )}
            </>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_IMAGES.map((img) => (
          <button
            key={img.path}
            type="button"
            onClick={() => onUrl(img.path)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition",
              imageUrl === img.path ? "border-brand bg-brand text-white shadow" : "border-line bg-white text-muted hover:border-brand hover:text-brand"
            )}
          >
            {img.label}
          </button>
        ))}
      </div>

      {/* Manual URL */}
      <input
        type="text"
        placeholder="Ou saisissez un lien d'image..."
        value={imageUrl}
        onChange={(e) => onUrl(e.target.value)}
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-dark placeholder:text-muted outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition"
      />
    </div>
  );
}
