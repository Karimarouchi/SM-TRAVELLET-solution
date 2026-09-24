import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "fr" | "en";
const LANG_KEY = "smtravel_lang";

type LanguageContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  /** t("texte français", "english text") — renvoie la chaîne dans la langue active. */
  t: (fr: string, en: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLang(): Language {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  return "fr";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(getInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(next: Language) {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function t(fr: string, en: string) {
    return lang === "en" ? en : fr;
  }

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
