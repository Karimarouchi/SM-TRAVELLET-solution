import { getSession, resendVerificationEmail, verifyEmailCode, postLoginPath, logout } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { motion } from "motion/react";
import { CheckCircle2, MailCheck, RefreshCw } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function VerifyEmailPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const session = getSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!session?.user) {
      navigate("/login", { replace: true });
      return;
    }
    if (session.user.emailVerified !== false) {
      navigate(postLoginPath(session), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session?.user) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 8) return;
    setLoading(true);
    setError("");
    try {
      const updated = await verifyEmailCode(code.trim());
      navigate(postLoginPath(updated), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Code invalide.", "Invalid code."));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    setResent(false);
    try {
      await resendVerificationEmail();
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Échec de l'envoi.", "Sending failed."));
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-dark via-brand to-violet-500 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-[0_24px_60px_rgba(0,0,0,.25)]"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-light">
          <MailCheck className="h-8 w-8 text-brand" />
        </div>
        <h1 className="mt-5 text-center font-display text-2xl font-extrabold text-dark">
          {t("Vérifiez votre email", "Verify your email")}
        </h1>
        <p className="mt-2 text-center text-sm text-muted">
          {t(
            `Nous avons envoyé un code à 8 chiffres à ${session.user.email}. Saisissez-le ci-dessous pour activer votre compte.`,
            `We sent an 8-digit code to ${session.user.email}. Enter it below to activate your account.`
          )}
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="00000000"
            autoFocus
            className="w-full rounded-2xl border border-line bg-slate-50 px-4 py-3.5 text-center font-mono text-2xl font-bold tracking-[0.5em] text-dark outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
          />
          {error && <p className="mt-2 text-center text-sm text-red-500">{error}</p>}
          {resent && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> {t("Nouveau code envoyé.", "New code sent.")}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || code.length !== 8}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t("Vérification...", "Verifying...") : t("Valider le code", "Verify code")}
          </button>
        </form>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-brand hover:underline disabled:opacity-50"
        >
          <RefreshCw className={resending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {t("Renvoyer le code", "Resend code")}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 w-full text-center text-xs text-muted hover:underline"
        >
          {t("Se déconnecter", "Log out")}
        </button>
      </motion.div>
    </main>
  );
}
