import { forgotPassword, resetPassword, verifyResetCode } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { motion } from "motion/react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, MailCheck, RefreshCw } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

type Step = "email" | "code" | "password" | "done";

const RESEND_SECONDS = 60;

const inputClass =
  // 16 px : évite le zoom automatique d'iOS au toucher d'un champ.
  "w-full rounded-2xl border border-line bg-slate-50 px-4 py-3.5 text-base text-dark outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10";

const primaryButton =
  "mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50";

// Mot de passe oublié : 1) email  2) code reçu par email  3) nouveau mot de passe.
export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email || "");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [resent, setResent] = useState(false);

  // Compte à rebours avant de pouvoir redemander un code.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const fail = (err: unknown) => setError(err instanceof Error ? err.message : t("Une erreur est survenue.", "Something went wrong."));

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError(t("Saisissez une adresse email valide.", "Enter a valid email address."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await forgotPassword(address);
      setCode("");
      setResendIn(RESEND_SECONDS);
      setStep("code");
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResent(false);
    setLoading(true);
    setError("");
    try {
      await forgotPassword(email.trim());
      setCode("");
      setResendIn(RESEND_SECONDS);
      setResent(true);
      window.setTimeout(() => setResent(false), 5000);
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }

  async function checkCode(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 8) return;
    setLoading(true);
    setError("");
    try {
      const result = await verifyResetCode(email.trim(), code);
      setResetToken(result.resetToken);
      setStep("password");
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError(t("Le mot de passe doit contenir au moins 8 caractères.", "The password must be at least 8 characters."));
      return;
    }
    if (password !== confirm) {
      setError(t("Les deux mots de passe ne sont pas identiques.", "The two passwords do not match."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await resetPassword(resetToken, password);
      setStep("done");
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }

  const icon =
    step === "done" ? <CheckCircle2 className="h-8 w-8 text-emerald-600" /> : step === "code" ? <MailCheck className="h-8 w-8 text-brand" /> : step === "password" ? <Lock className="h-8 w-8 text-brand" /> : <KeyRound className="h-8 w-8 text-brand" />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-dark via-brand to-violet-500 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,.25)] sm:p-8"
      >
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${step === "done" ? "bg-emerald-50" : "bg-brand-light"}`}>{icon}</div>

        {/* Indicateur d'étape */}
        {step !== "done" && (
          <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-wider text-muted">
            {t("Étape", "Step")} {step === "email" ? 1 : step === "code" ? 2 : 3} / 3
          </p>
        )}

        {/* ── 1. Email ─────────────────────────────────────────────────── */}
        {step === "email" && (
          <>
            <h1 className="mt-2 text-center font-display text-2xl font-extrabold text-dark">{t("Mot de passe oublié ?", "Forgot your password?")}</h1>
            <p className="mt-2 text-center text-sm text-muted">
              {t(
                "Saisissez l'adresse email de votre compte. Nous vous enverrons un code de vérification.",
                "Enter your account email. We'll send you a verification code."
              )}
            </p>
            <form onSubmit={sendCode} className="mt-6" noValidate>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted" htmlFor="forgot-email">
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="vous@exemple.com"
                className={inputClass}
              />
              {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
              <button type="submit" disabled={loading} className={primaryButton}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? t("Envoi...", "Sending...") : t("Envoyer le code", "Send the code")}
              </button>
            </form>
          </>
        )}

        {/* ── 2. Code ──────────────────────────────────────────────────── */}
        {step === "code" && (
          <>
            <h1 className="mt-2 text-center font-display text-2xl font-extrabold text-dark">{t("Vérifiez vos emails", "Check your email")}</h1>
            <p className="mt-2 text-center text-sm text-muted">
              {t(
                `Si un compte existe avec ${email.trim()}, un code à 8 chiffres vient d'être envoyé. Saisissez-le ci-dessous (valable 15 minutes).`,
                `If an account exists for ${email.trim()}, an 8-digit code has just been sent. Enter it below (valid for 15 minutes).`
              )}
            </p>
            <form onSubmit={checkCode} className="mt-6">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }}
                placeholder="00000000"
                autoFocus
                aria-label={t("Code à 8 chiffres", "8-digit code")}
                className="w-full rounded-2xl border border-line bg-slate-50 px-4 py-3.5 text-center font-mono text-2xl font-bold tracking-[0.5em] text-dark outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
              />
              {error && <p role="alert" className="mt-2 text-center text-sm text-red-500">{error}</p>}
              {resent && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> {t("Nouveau code envoyé.", "New code sent.")}
                </p>
              )}
              <button type="submit" disabled={loading || code.length !== 8} className={primaryButton}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? t("Vérification...", "Verifying...") : t("Valider le code", "Verify code")}
              </button>
            </form>
            <button
              type="button"
              onClick={resend}
              disabled={loading || resendIn > 0}
              className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-brand hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
            >
              <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              {resendIn > 0 ? t(`Renvoyer le code (${resendIn} s)`, `Resend code (${resendIn}s)`) : t("Renvoyer le code", "Resend code")}
            </button>
            <p className="mt-3 text-center text-xs text-muted">{t("Rien reçu ? Regardez dans vos courriers indésirables (spam).", "Nothing received? Check your spam folder.")}</p>
            <button type="button" onClick={() => { setStep("email"); setError(""); }} className="mt-2 w-full text-center text-xs font-semibold text-muted hover:text-brand hover:underline">
              {t("Changer d'adresse email", "Change email address")}
            </button>
          </>
        )}

        {/* ── 3. Nouveau mot de passe ──────────────────────────────────── */}
        {step === "password" && (
          <>
            <h1 className="mt-2 text-center font-display text-2xl font-extrabold text-dark">{t("Nouveau mot de passe", "New password")}</h1>
            <p className="mt-2 text-center text-sm text-muted">{t("Code vérifié. Choisissez votre nouveau mot de passe (8 caractères minimum).", "Code verified. Choose your new password (at least 8 characters).")}</p>
            <form onSubmit={changePassword} className="mt-6" noValidate>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted" htmlFor="new-password">
                {t("Nouveau mot de passe", "New password")}
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? t("Masquer le mot de passe", "Hide password") : t("Afficher le mot de passe", "Show password")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted transition hover:text-brand"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <label className="mb-1.5 mt-3 block text-[11px] font-bold uppercase tracking-wide text-muted" htmlFor="confirm-password">
                {t("Confirmer le mot de passe", "Confirm password")}
              </label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                className={inputClass}
              />
              {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
              <button type="submit" disabled={loading} className={primaryButton}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? t("Enregistrement...", "Saving...") : t("Changer le mot de passe", "Change password")}
              </button>
            </form>
          </>
        )}

        {/* ── 4. Terminé ───────────────────────────────────────────────── */}
        {step === "done" && (
          <>
            <h1 className="mt-5 text-center font-display text-2xl font-extrabold text-dark">{t("Mot de passe modifié", "Password changed")}</h1>
            <p className="mt-2 text-center text-sm text-muted">{t("Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.", "You can now log in with your new password.")}</p>
            <button type="button" onClick={() => navigate("/login", { replace: true })} className={primaryButton}>
              {t("Se connecter", "Log in")}
            </button>
          </>
        )}

        {step !== "done" && (
          <Link to="/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm font-semibold text-brand hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> {t("Retour à la connexion", "Back to log in")}
          </Link>
        )}
      </motion.div>
    </main>
  );
}
