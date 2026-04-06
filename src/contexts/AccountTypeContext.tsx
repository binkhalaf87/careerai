import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type AccountType = "job_seeker" | "recruiter" | null;

interface AccountTypeContextType {
  accountType: AccountType;
  loading: boolean;
  setAccountType: (type: AccountType) => Promise<void>;
  companyName: string | null;
  onboardingCompleted: boolean;
  refetch: () => Promise<void>;
  /** The account_type stored in database (permanent) */
  dbAccountType: AccountType;
  /** Switch active view without changing DB */
  switchView: (type: AccountType) => void;
}

const ACTIVE_VIEW_KEY = "talentry_active_view";

const AccountTypeContext = createContext<AccountTypeContextType>({
  accountType: null,
  loading: true,
  setAccountType: async () => {},
  companyName: null,
  onboardingCompleted: false,
  refetch: async () => {},
  dbAccountType: null,
  switchView: () => {},
});

export const AccountTypeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [dbAccountType, setDbAccountType] = useState<AccountType>(null);
  const [activeView, setActiveView] = useState<AccountType>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setDbAccountType(null);
      setActiveView(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("account_type, company_name, onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const dbType = (data.account_type as AccountType) || null;
        setDbAccountType(dbType);
        setCompanyName(data.company_name || null);
        setOnboardingCompleted(data.onboarding_completed || false);

        // Determine active view: check localStorage, then URL, then DB
        const savedView = localStorage.getItem(ACTIVE_VIEW_KEY) as AccountType;
        const isOnRecruiterRoute = window.location.pathname.startsWith("/recruiter");

        if (isOnRecruiterRoute) {
          setActiveView("recruiter");
          localStorage.setItem(ACTIVE_VIEW_KEY, "recruiter");
        } else if (savedView && (savedView === "job_seeker" || savedView === "recruiter")) {
          setActiveView(savedView);
        } else {
          setActiveView(dbType);
        }
      }
    } catch (e) {
      console.error("[AccountType] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const setAccountType = useCallback(async (type: AccountType) => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ account_type: type })
      .eq("user_id", user.id);
    setDbAccountType(type);
    setActiveView(type);
    if (type) localStorage.setItem(ACTIVE_VIEW_KEY, type);
  }, [user]);

  const switchView = useCallback((type: AccountType) => {
    setActiveView(type);
    if (type) localStorage.setItem(ACTIVE_VIEW_KEY, type);
  }, []);

  return (
    <AccountTypeContext.Provider value={{
      accountType: activeView,
      loading,
      setAccountType,
      companyName,
      onboardingCompleted,
      refetch: fetchProfile,
      dbAccountType,
      switchView,
    }}>
      {children}
    </AccountTypeContext.Provider>
  );
};

export const useAccountType = () => useContext(AccountTypeContext);
