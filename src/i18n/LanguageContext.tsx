import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from "react";
import { translations, Language } from "./translations";
import { supabase } from "@/integrations/supabase/client";

type TranslationValues = typeof translations.en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: TranslationValues;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = "app_language";

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "ar";
}

function getStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : "en";
  } catch {
    return "en";
  }
}

function applyDocumentLanguage(lang: Language) {
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => getStoredLanguage());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    applyDocumentLanguage(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore storage errors
    }
  }, [language]);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    applyDocumentLanguage(lang);

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }

    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (user) {
        const { error } = await supabase.from("profiles").update({ language: lang }).eq("user_id", user.id);

        if (error) {
          console.error("[LanguageContext] failed to update profile language:", error.message);
        }
      }
    } catch (error) {
      console.error("[LanguageContext] setLanguage error:", error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncLanguageFromProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase.from("profiles").select("language").eq("user_id", userId).maybeSingle();

        if (error) {
          console.error("[LanguageContext] profile language load error:", error.message);
          return;
        }

        if (!cancelled && data?.language && isLanguage(data.language)) {
          setLanguageState(data.language);
          try {
            localStorage.setItem(STORAGE_KEY, data.language);
          } catch {
            // ignore storage errors
          }
          applyDocumentLanguage(data.language);
        }
      } catch (error) {
        console.error("[LanguageContext] syncLanguageFromProfile error:", error);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        void syncLanguageFromProfile(session.user.id);
      }
    });

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        void syncLanguageFromProfile(data.user.id);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const dir: "ltr" | "rtl" = language === "ar" ? "rtl" : "ltr";
  const t = useMemo<TranslationValues>(() => {
    return (language === "ar" ? translations.ar : translations.en) as TranslationValues;
  }, [language]);

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage,
      t,
      dir,
    }),
    [language, setLanguage, t, dir],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
