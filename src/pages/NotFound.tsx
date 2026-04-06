import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-display font-bold text-foreground">{t.notFound.title}</h1>
        <p className="mb-4 text-xl text-muted-foreground font-body">{t.notFound.message}</p>
        <a href="/" className="text-primary underline hover:text-primary/90 font-body">
          {t.notFound.backHome}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
