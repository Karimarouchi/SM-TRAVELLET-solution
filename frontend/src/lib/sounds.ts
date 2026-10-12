// Sons de l'application (équipe SM) : un carillon pour les notifications du système, un « pop » plus vif
// pour les messages WhatsApp. Générés par le navigateur (aucun fichier audio), coupables d'un clic.
const MUTE_KEY = "sm-sound-muted";
export const SOUND_CHANGED = "sm-sound-changed";

let context: AudioContext | null = null;

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* stockage indisponible : le choix vaut pour cette session */
  }
  window.dispatchEvent(new Event(SOUND_CHANGED));
}

function audio(): AudioContext | null {
  if (!context) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  return context;
}

// Les navigateurs interdisent le son avant une première interaction : on le débloque au premier clic ou à la première touche.
export function unlockAudio() {
  const ctx = audio();
  if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => undefined);
}
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlockAudio, { once: true });
  window.addEventListener("keydown", unlockAudio, { once: true });
}

function note(ctx: AudioContext, frequency: number, start: number, duration: number, volume: number, type: OscillatorType) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

function play(notes: Array<[number, number, number]>, volume: number, type: OscillatorType) {
  if (isSoundMuted()) return;
  const ctx = audio();
  // Audio encore verrouillé (aucune interaction) : on reste silencieux plutôt que de provoquer une erreur.
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  notes.forEach(([frequency, offset, duration]) => note(ctx, frequency, now + offset, duration, volume, type));
}

/** Notification du système : deux notes douces, montantes. */
export function playNotificationSound() {
  play([[659, 0, 0.22], [880, 0.14, 0.34]], 0.12, "sine");
}

/** Message WhatsApp : deux « pop » brefs et plus aigus. */
export function playWhatsAppSound() {
  play([[988, 0, 0.09], [1319, 0.11, 0.12]], 0.1, "triangle");
}

export const isStaffRole = (role?: string) => role === "ADMIN" || role === "SALES" || role === "RDV";
