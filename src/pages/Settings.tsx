import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, ArrowRightLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAccountType } from "@/contexts/AccountTypeContext";

const Settings = () => {
  const { t, language, setLanguage } = useLanguage();
  const { dbAccountType, switchView } = useAccountType();
  const navigate = useNavigate();

  const items = [
    { label: t.settings.account, description: t.settings.accountDesc },
    { label: t.settings.notifications, description: t.settings.notificationsDesc },
    { label: t.settings.billing, description: t.settings.billingDesc },
    { label: t.settings.privacy, description: t.settings.privacyDesc },
  ];

  const handleSwitchToRecruiter = () => {
    switchView("recruiter");
    navigate("/recruiter/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="container flex items-center gap-4 h-16">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard"><ArrowLeft size={18} /></Link>
          </Button>
          <Link to="/dashboard" className="font-display text-lg font-bold text-foreground">
            TALEN<span className="text-primary">TRY</span>
          </Link>
          <span className="text-border/60 hidden sm:inline">/</span>
          <h1 className="font-display font-semibold text-foreground text-sm hidden sm:block">{t.settings.title}</h1>
        </div>
      </header>

      <main className="container py-8 md:py-12 max-w-lg">
        {/* Switch to Recruiter Dashboard */}
        {dbAccountType === "recruiter" && (
          <div className="p-4 bg-card rounded-xl border border-border mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-foreground text-sm">
                  {language === "ar" ? "التبديل إلى لوحة التوظيف" : "Switch to Recruiter Dashboard"}
                </h3>
                <p className="text-xs text-muted-foreground font-body mt-0.5">
                  {language === "ar" ? "الانتقال إلى مساحة عمل التوظيف" : "Go to the hiring workspace"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleSwitchToRecruiter}>
                <ArrowRightLeft size={14} className="mr-1.5" />
                {language === "ar" ? "تبديل" : "Switch"}
              </Button>
            </div>
          </div>
        )}

        {/* Language switcher */}
        <div className="p-4 bg-card rounded-xl border border-border mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe size={18} className="text-primary" />
              <div>
                <h3 className="font-display font-semibold text-foreground text-sm">{t.settings.language}</h3>
                <p className="text-xs text-muted-foreground font-body mt-0.5">{t.settings.languageDesc}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant={language === "en" ? "default" : "outline"} size="sm" onClick={() => setLanguage("en")}>EN</Button>
              <Button variant={language === "ar" ? "default" : "outline"} size="sm" onClick={() => setLanguage("ar")}>ع</Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="p-4 bg-card rounded-xl border border-border hover:shadow-elevated transition-shadow cursor-pointer"
            >
              <h3 className="font-display font-semibold text-foreground text-sm">{item.label}</h3>
              <p className="text-xs text-muted-foreground font-body mt-1">{item.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Settings;
