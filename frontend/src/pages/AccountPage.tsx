import { changeMyEmail, changeMyPassword, getSession, setSession } from "@/lib/auth";
import { CheckCircle2, KeyRound, Mail, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

const HOME: Record<string, string> = { ADMIN: "/admin", SALES: "/conseiller", RDV: "/rdv" };

// « Mon compte » de l'équipe : e-mail et mot de passe de connexion, confirmés par le mot de passe actuel.
export default function AccountPage() {
  const navigate = useNavigate();
  const session = getSession();
  const forced = Boolean(session?.user.mustChangePassword);
  const [email, setEmail] = useState(session?.user.email || "");
  const [emailPassword, setEmailPassword] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"email" | "password" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const run = async (kind: "email" | "password", action: () => Promise<void>) => {
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setBusy(null);
    }
  };

  const savePassword = (event: FormEvent) => {
    event.preventDefault();
    if (next !== confirm) return setError("Les deux nouveaux mots de passe ne sont pas identiques.");
    void run("password", async () => {
      setSession(await changeMyPassword(current, next));
      setCurrent("");
      setNext("");
      setConfirm("");
      if (forced) {
        navigate(HOME[session?.user.role || ""] || "/", { replace: true });
        return;
      }
      setNotice("Mot de passe modifié.");
    });
  };

  const saveEmail = (event: FormEvent) => {
    event.preventDefault();
    void run("email", async () => {
      const updated = await changeMyEmail(emailPassword, email);
      setSession(updated);
      setEmail(updated.user.email);
      setEmailPassword("");
      setNotice("Adresse e-mail modifiée : utilisez-la pour vous connecter.");
    });
  };

  const input = "mt-1 w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm text-dark";
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
      <h1 className="font-display text-2xl font-extrabold text-dark">Mon compte</h1>
      <p className="mt-1 text-sm text-muted">L'adresse e-mail et le mot de passe que vous utilisez pour vous connecter à l'application.</p>

      {forced && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Votre mot de passe a été choisi par l'administrateur. Choisissez-en un nouveau pour continuer.
        </p>
      )}
      {notice && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden /> {notice}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>}

      <form onSubmit={savePassword} className="mt-5 rounded-[24px] border border-line bg-white p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark"><KeyRound className="h-5 w-5 text-brand" aria-hidden /> Mot de passe</h2>
        <label className="mt-4 block text-xs font-bold text-mid">Mot de passe actuel
          <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-mid">Nouveau mot de passe
            <input type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={input} />
          </label>
          <label className="block text-xs font-bold text-mid">Confirmer
            <input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-muted">8 caractères minimum.</p>
        <button type="submit" disabled={busy !== null} className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {busy === "password" ? "Enregistrement..." : "Changer le mot de passe"}
        </button>
      </form>

      {!forced && (
        <form onSubmit={saveEmail} className="mt-4 rounded-[24px] border border-line bg-white p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark"><Mail className="h-5 w-5 text-brand" aria-hidden /> Adresse e-mail de connexion</h2>
          <label className="mt-4 block text-xs font-bold text-mid">Adresse e-mail
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>
          <label className="mt-3 block text-xs font-bold text-mid">Mot de passe actuel (pour confirmer)
            <input type="password" required autoComplete="current-password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} className={input} />
          </label>
          <button type="submit" disabled={busy !== null || email.trim().toLowerCase() === (session?.user.email || "").toLowerCase()} className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {busy === "email" ? "Enregistrement..." : "Changer l'adresse e-mail"}
          </button>
        </form>
      )}
    </main>
  );
}
