import { SOUND_CHANGED, isSoundMuted, playNotificationSound, setSoundMuted, unlockAudio } from "@/lib/sounds";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

// Couper / remettre les sons de notification (équipe SM). Le choix est mémorisé dans ce navigateur.
export default function SoundToggle() {
  const [muted, setMuted] = useState(isSoundMuted());

  useEffect(() => {
    const sync = () => setMuted(isSoundMuted());
    window.addEventListener(SOUND_CHANGED, sync);
    return () => window.removeEventListener(SOUND_CHANGED, sync);
  }, []);

  const toggle = () => {
    const next = !muted;
    setSoundMuted(next);
    if (!next) {
      // Un petit son confirme que l'audio fonctionne.
      unlockAudio();
      window.setTimeout(playNotificationSound, 80);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={muted ? "Sons désactivés : cliquer pour les activer" : "Sons activés : cliquer pour les couper"}
      aria-label={muted ? "Activer les sons" : "Couper les sons"}
      aria-pressed={!muted}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-gray-900 transition hover:border-brand hover:text-brand"
    >
      {muted ? <VolumeX className="h-4 w-4 text-muted" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
