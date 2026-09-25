import { cn } from "@/lib/utils";
import { DEMO_ACCOUNT, login, postLoginPath, register } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { DatePickerField } from "@/components/ui/date-picker";
import { ArrowLeft, CalendarDays as CalendarIcon, DoorClosed, DoorOpen, KeyRound, Lock, Mail, PersonStanding, User, UserX } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VITRINE_URL } from "@/lib/site";
import "./auth-switch.css";

type Mode = "login" | "register";

type AuthSwitchProps = {
  defaultMode?: Mode;
};

export function AuthSwitch({ defaultMode = "login" }: AuthSwitchProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(defaultMode === "register");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasCode, setHasCode] = useState(false);
  const [loginAnim, setLoginAnim] = useState<"idle" | "success" | "fail">("idle");

  async function onSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const session = await login(String(form.get("email") || ""), String(form.get("password") || ""));
      setLoginAnim("success");
      window.setTimeout(() => navigate(postLoginPath(session)), 950);
    } catch (err) {
      setLoginAnim("fail");
      window.setTimeout(() => {
        setLoginAnim("idle");
        setLoading(false);
        setError(err instanceof Error ? err.message : t("Une erreur est survenue.", "Something went wrong."));
      }, 950);
    }
  }

  async function onSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const salesCode = String(form.get("salesCode") || "").trim();
      const session = await register({
        prenom: String(form.get("prenom") || ""),
        nom: String(form.get("nom") || ""),
        email: String(form.get("email") || ""),
        dateNaissance: String(form.get("dateNaissance") || ""),
        password: String(form.get("password") || ""),
        passwordConfirm: String(form.get("passwordConfirm") || ""),
        salesCode: salesCode || undefined
      });
      navigate(postLoginPath(session));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Une erreur est survenue.", "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("auth-switch-root")}>
      <span className="as-orb as-orb-1" />
      <span className="as-orb as-orb-2" />
      <span className="as-orb as-orb-3" />

      <a className="as-back" href={VITRINE_URL}>
        <ArrowLeft size={16} />
        <img src={`${import.meta.env.BASE_URL}images/logo-blanc.png`} alt="SM Travel" />
      </a>

      <div className={cn("as-container", isSignUp && "as-sign-up-mode")}>
        <div className="as-forms-container">
          <div className="as-signin-signup">
            <form className="as-sign-in-form" onSubmit={onSignIn} noValidate>
              <p className="as-kicker">{t("Espace client", "Client area")}</p>
              <h2 className="as-title">{t("Connexion", "Log in")}</h2>
              {import.meta.env.DEV && (
                <p className="as-demo">
                  {t("Compte démo", "Demo account")} : {DEMO_ACCOUNT.email} / {DEMO_ACCOUNT.password}
                </p>
              )}
              <div className="as-input-field">
                <span className="as-icon"><Mail size={18} /></span>
                <input name="email" type="email" placeholder="Email" required autoComplete="email" />
              </div>
              <div className="as-input-field">
                <span className="as-icon"><Lock size={18} /></span>
                <input name="password" type="password" placeholder={t("Mot de passe", "Password")} required autoComplete="current-password" />
              </div>
              {error && !isSignUp && <p className="as-error">{error}</p>}
              <button
                type="submit"
                className={cn("as-btn as-solid as-btn-with-scene", loginAnim !== "idle" && `as-anim-${loginAnim}`)}
                disabled={loading || loginAnim !== "idle"}
              >
                <span className={cn("as-btn-label", loginAnim !== "idle" && "as-btn-label-hidden")}>
                  {loading && !isSignUp ? "..." : t("Se connecter", "Log in")}
                </span>
                <span className="as-door-scene" aria-hidden="true">
                  <span className="as-walker">
                    <PersonStanding size={20} strokeWidth={2.25} />
                  </span>
                  <span className="as-door">
                    {loginAnim === "success" ? <DoorOpen size={22} strokeWidth={2} /> : <DoorClosed size={22} strokeWidth={2} />}
                  </span>
                  {loginAnim === "fail" && (
                    <span className="as-bouncer">
                      <UserX size={18} strokeWidth={2.25} />
                    </span>
                  )}
                </span>
              </button>
              <p className="as-social-text">{t("Ou continuer avec", "Or continue with")}</p>
              <div className="as-social-media">
                <SocialIcons />
              </div>
            </form>

            <form className="as-sign-up-form" onSubmit={onSignUp} noValidate>
              <p className="as-kicker">{t("Espace client", "Client area")}</p>
              <h2 className="as-title">{t("Inscription", "Sign up")}</h2>
              <div className="as-input-field">
                <span className="as-icon"><User size={18} /></span>
                <input name="prenom" type="text" placeholder={t("Prénom", "First name")} required autoComplete="given-name" />
              </div>
              <div className="as-input-field">
                <span className="as-icon"><User size={18} /></span>
                <input name="nom" type="text" placeholder={t("Nom", "Last name")} required autoComplete="family-name" />
              </div>
              <div className="as-input-field">
                <span className="as-icon"><Mail size={18} /></span>
                <input name="email" type="email" placeholder="Email" required autoComplete="email" />
              </div>
              <div className="as-input-field">
                <span className="as-icon"><CalendarIcon size={18} /></span>
                <DatePickerField name="dateNaissance" required bare />
              </div>
              <div className="as-input-field">
                <span className="as-icon"><Lock size={18} /></span>
                <input name="password" type="password" placeholder={t("Mot de passe", "Password")} required minLength={8} autoComplete="new-password" />
              </div>
              <div className="as-input-field">
                <span className="as-icon"><Lock size={18} /></span>
                <input name="passwordConfirm" type="password" placeholder={t("Confirmer le mot de passe", "Confirm password")} required minLength={8} autoComplete="new-password" />
              </div>

              <label className="flex items-center gap-2 py-1 text-xs font-semibold" style={{ color: "var(--as-ink)" }}>
                <input
                  type="checkbox"
                  checked={hasCode}
                  onChange={(e) => setHasCode(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--as-brand)]"
                />
                {t("J'ai reçu un code de mon conseiller", "I received a code from my advisor")}
              </label>
              {hasCode && (
                <div className="as-input-field">
                  <span className="as-icon"><KeyRound size={18} /></span>
                  <input
                    name="salesCode"
                    type="text"
                    placeholder={t("Code (ex: SM-X7K29P)", "Code (e.g. SM-X7K29P)")}
                    autoComplete="off"
                    style={{ textTransform: "uppercase" }}
                  />
                </div>
              )}

              {error && isSignUp && <p className="as-error">{error}</p>}
              <button type="submit" className="as-btn" disabled={loading}>
                {loading && isSignUp ? "..." : t("S'inscrire", "Sign up")}
              </button>
            </form>
          </div>
        </div>

        <div className="as-panels-container">
          <div className="as-panel as-left-panel">
            <div className="as-content">
              <h3>{t("Nouveau ici ?", "New here?")}</h3>
              <p>{t("Rejoignez SM Travel et démarrez votre projet d’études à l’étranger en quelques secondes.", "Join SM Travel and start your study-abroad project in a few seconds.")}</p>
              <button type="button" className="as-btn as-transparent" onClick={() => { setError(""); setIsSignUp(true); }}>
                {t("S'inscrire", "Sign up")}
              </button>
            </div>
          </div>
          <div className="as-panel as-right-panel">
            <div className="as-content">
              <h3>{t("Déjà membre ?", "Already a member?")}</h3>
              <p>{t("Bon retour. Connectez-vous pour reprendre votre accompagnement SM Travel.", "Welcome back. Log in to continue your SM Travel support.")}</p>
              <button type="button" className="as-btn as-transparent" onClick={() => { setError(""); setIsSignUp(false); }}>
                {t("Connexion", "Log in")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialIcons() {
  return (
    <>
      <a href="#google" className="as-social-icon" aria-label="Google">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      </a>
      <a href="#facebook" className="as-social-icon" aria-label="Facebook">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </a>
      <a href="#twitter" className="as-social-icon" aria-label="Twitter">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#1DA1F2">
          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
        </svg>
      </a>
      <a href="#linkedin" className="as-social-icon" aria-label="LinkedIn">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </a>
    </>
  );
}

export const Component = AuthSwitch;
export default AuthSwitch;
