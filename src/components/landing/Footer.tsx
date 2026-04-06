import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const Footer = () => {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <footer className="border-t border-border bg-card py-14" dir={ar ? "rtl" : "ltr"}>
      <div className="container">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link to="/" className="font-display font-bold text-xl text-foreground tracking-wide inline-block mb-3">
              TALEN<span className="text-primary">TRY</span>
            </Link>
            <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xs">
              {ar
                ? "منصة ذكية لبناء المسيرة المهنية والتوظيف الذكي — مدعومة بالذكاء الاصطناعي."
                : "AI-powered platform for career building and smarter hiring."}
            </p>
          </div>

          {/* For Job Seekers */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4 text-sm">
              {ar ? "للباحثين عن عمل" : "For Job Seekers"}
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: ar ? "تحليل السيرة" : "Resume Analysis", href: "#features" },
                { label: ar ? "تحسين السيرة" : "Resume Enhancement", href: "#features" },
                { label: ar ? "بناء السيرة" : "Resume Builder", href: "#features" },
                { label: ar ? "التقديم الذكي" : "Smart Applications", href: "#features" },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground font-body transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* For Recruiters */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4 text-sm">
              {ar ? "لمسؤولي التوظيف" : "For Recruiters"}
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: ar ? "تحليل المرشحين" : "Candidate Analysis", href: "#features" },
                { label: ar ? "ترتيب المرشحين" : "Candidate Ranking", href: "#features" },
                { label: ar ? "المقابلات الذكية" : "AI Interviews", href: "#features" },
                { label: ar ? "لوحة التحكم" : "Dashboard", href: "#features" },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground font-body transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4 text-sm">
              {ar ? "الشركة" : "Company"}
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: ar ? "الأسعار" : "Pricing", href: "#pricing" },
                { label: ar ? "كيف يعمل" : "How It Works", href: "#how-it-works" },
                { label: ar ? "الأسئلة الشائعة" : "FAQ", href: "#faq" },
                { label: ar ? "سياسة الخصوصية" : "Privacy Policy", href: "#" },
                { label: ar ? "تواصل معنا" : "Contact", href: "#" },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground font-body transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-7 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground font-body">
            © {new Date().getFullYear()} TALENTRY. {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}
          </p>
          <p className="text-xs text-muted-foreground font-body">
            {ar ? "نظام التشغيل المهني بالذكاء الاصطناعي" : "AI Career Operating System"}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;


