import { fetchWhatsAppMediaBlob, type WhatsAppMessage } from "@/lib/whatsapp";
import { FileText, Download, Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";

// Fichier joint d'un message WhatsApp : image (clic = taille réelle), message vocal ou audio (lecteur), vidéo (lecteur, chargée au clic)
// ou pastille du document (clic = téléchargement).
export default function WhatsAppMedia({ contactId, message }: { contactId: string; message: WhatsAppMessage }) {
  const media = message.media;
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Images et messages vocaux se chargent tout de suite ; la vidéo (plus lourde) seulement quand on le demande.
  const [wantVideo, setWantVideo] = useState(false);
  useEffect(() => {
    if (!media || (media.kind !== "image" && media.kind !== "audio" && !(media.kind === "video" && wantVideo))) return;
    let objectUrl = "";
    let cancelled = false;
    fetchWhatsAppMediaBlob(contactId, message.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Image indisponible."));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [contactId, message.id, media, wantVideo]);

  if (!media) return null;

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const blob = await fetchWhatsAppMediaBlob(contactId, message.id);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = media.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Téléchargement impossible.");
    } finally {
      setBusy(false);
    }
  };

  if (media.kind === "audio") {
    return (
      <div className="mb-1 min-w-[230px]">
        {url ? (
          <audio controls preload="metadata" src={url} className="h-10 w-full" aria-label="Message vocal" />
        ) : (
          <div className="flex h-10 items-center gap-2 text-xs text-[#667781]">{error ? error : <><Loader2 className="h-4 w-4 animate-spin" /> Chargement du message vocal…</>}</div>
        )}
        {message.caption && <p className="mt-1 whitespace-pre-wrap break-words">{message.caption}</p>}
      </div>
    );
  }

  if (media.kind === "video") {
    return (
      <div className="mb-1">
        {url ? (
          <video controls preload="metadata" src={url} className="max-h-72 w-full rounded-md bg-black" aria-label={media.name} />
        ) : (
          <button type="button" onClick={() => setWantVideo(true)} disabled={wantVideo} className="flex h-28 w-52 flex-col items-center justify-center gap-1 rounded-md bg-black/5 text-xs font-semibold text-[#54656f] transition hover:bg-black/10">
            {wantVideo && !error ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-6 w-6" aria-hidden />}
            {error ? error : wantVideo ? "Chargement…" : "Charger la vidéo"}
          </button>
        )}
        {message.caption && <p className="mt-1 whitespace-pre-wrap break-words">{message.caption}</p>}
      </div>
    );
  }

  if (media.kind === "image") {
    return (
      <div className="mb-1">
        {url ? (
          <button type="button" onClick={() => window.open(url, "_blank", "noopener")} className="block overflow-hidden rounded-md" aria-label={`Ouvrir l'image ${media.name}`}>
            <img src={url} alt={media.name} className="max-h-64 w-full rounded-md object-cover" />
          </button>
        ) : (
          <div className="flex h-32 w-48 items-center justify-center rounded-md bg-black/5 text-xs text-[#667781]">
            {error ? error : <Loader2 className="h-4 w-4 animate-spin" aria-label="Chargement de l'image" />}
          </div>
        )}
        {message.caption && <p className="mt-1 whitespace-pre-wrap break-words">{message.caption}</p>}
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button type="button" onClick={download} disabled={busy} className="flex w-full min-w-[200px] items-center gap-2.5 rounded-lg bg-black/5 px-3 py-2.5 text-left transition hover:bg-black/10 disabled:opacity-70">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#00a884]"><FileText className="h-5 w-5" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-[#111b21]">{media.name}</span>
          <span className="block text-[11px] text-[#667781]">{error || "Appuyer pour télécharger"}</span>
        </span>
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-[#667781]" /> : <Download className="h-4 w-4 text-[#667781]" aria-hidden />}
      </button>
      {message.caption && <p className="mt-1 whitespace-pre-wrap break-words">{message.caption}</p>}
    </div>
  );
}
