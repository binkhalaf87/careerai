import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { RecruiterSidebar } from "@/components/recruiter/RecruiterSidebar";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function RecruiterLayout({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const ar = language === "ar";

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full" dir={ar ? "rtl" : "ltr"}>
        <RecruiterSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 h-12 flex items-center justify-between border-b border-border/80 bg-background/85 backdrop-blur px-3">
            <SidebarTrigger />
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout" className="h-8 w-8">
              <LogOut size={16} />
            </Button>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
