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

      <a className={cn("as-back", isSignUp && "as-back-dark")} href={VITRINE_URL}>
        <ArrowLeft size={16} />
        <img
          src={`${import.meta.env.BASE_URL}images/${isSignUp ? "logo-color.png" : "logo-blanc.png"}`}
          alt="SM Travel"
        />
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

export const Component = AuthSwitch;
export default AuthSwitch;
