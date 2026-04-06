import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const ar = language === "ar";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const links = [
    { label: t.nav.features, href: "#features" },
    { label: t.nav.howItWorks, href: "#how-it-works" },
    { label: t.nav.pricing, href: "#pricing" },
    { label: t.nav.faq, href: "#faq" },
  ];

  const toggleLang = () => setLanguage(language === "en" ? "ar" : "en");

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? "bg-card/90 backdrop-blur-xl border-b border-border shadow-card" : "bg-transparent"
    }`} dir={ar ? "rtl" : "ltr"}>
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="font-display font-bold text-xl text-foreground tracking-wide">
          TALEN<span className="text-primary">TRY</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={toggleLang} className="font-body text-xs px-3 h-8">
            {language === "en" ? "العربية" : "English"}
          </Button>
          {user ? (
            <Button size="sm" asChild>
              <Link to="/dashboard">{t.nav.dashboard}</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">{t.nav.login}</Link>
              </Button>
              <Button size="sm" className="shadow-sm" asChild>
                <Link to="/signup">{ar ? "ابدأ مجاناً" : "Start Free"}</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-card border-b border-border px-6 pb-6 space-y-4 animate-fade-up">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="block text-sm font-body text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Button variant="ghost" size="sm" onClick={toggleLang} className="w-full font-body text-xs">
            {language === "en" ? "العربية" : "English"}
          </Button>
          <div className="flex gap-3 pt-2">
            {user ? (
              <Button size="sm" className="flex-1" asChild>
                <Link to="/dashboard">{t.nav.dashboard}</Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link to="/login">{t.nav.login}</Link>
                </Button>
                <Button size="sm" className="flex-1" asChild>
                  <Link to="/signup">{ar ? "ابدأ مجاناً" : "Start Free"}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
