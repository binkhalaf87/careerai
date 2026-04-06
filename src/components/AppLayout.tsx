import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Coins } from "lucide-react";
import { usePoints } from "@/hooks/usePoints";
import AIChatAssistant from "@/components/chat/AIChatAssistant";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { balance, loading: pointsLoading } = usePoints();
  const ar = language === "ar";

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full" dir={ar ? "rtl" : "ltr"}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 h-12 flex items-center justify-between border-b border-border/80 bg-background/85 backdrop-blur px-3">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={() => navigate("/pricing")}
              >
                <Coins className="h-3.5 w-3.5 text-primary" />
                {pointsLoading ? "…" : balance} {ar ? "نقطة" : "pts"}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout" className="h-8 w-8">
                <LogOut size={16} />
              </Button>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
      <AIChatAssistant />
    </SidebarProvider>
  );
}
