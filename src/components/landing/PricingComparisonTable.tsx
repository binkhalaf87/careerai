import { motion, useInView } from "framer-motion";
import { Check, X, Sparkles, Crown, Zap, Star } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useRef } from "react";

type CellValue = boolean | string;

interface FeatureRow {
  label: string;
  free: CellValue;
  starter: CellValue;
  pro: CellValue;
  business: CellValue;
  category?: string;
}

const PricingComparisonTable = () => {
  const { language } = useLanguage();
  const ar = language === "ar";
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const plans = [
    { key: "free", name: ar ? "مجاني" : "Free", icon: Star, price: ar ? "مجاناً" : "Free", color: "text-muted-foreground" },
    { key: "starter", name: ar ? "المبتدئ" : "Starter", icon: Zap, price: ar ? "29 ر.س/شهر" : "29 SAR/mo", color: "text-blue-500" },
    { key: "pro", name: ar ? "المحترف" : "Pro", icon: Sparkles, price: ar ? "79 ر.س/شهر" : "79 SAR/mo", color: "text-primary", highlight: true },
    { key: "business", name: ar ? "الأعمال" : "Business", icon: Crown, price: ar ? "149 ر.س/شهر" : "149 SAR/mo", color: "text-amber-500" },
  ];

  const features: FeatureRow[] = [
    // Credits
    {
      category: ar ? "النقاط والاستخدام" : "Credits & Usage",
      label: ar ? "النقاط الشهرية" : "Monthly credits",
      free: "—",
      starter: "30",
      pro: "100",
      business: "300",
    },
    {
      label: ar ? "تحليل مجاني أول" : "Free first analysis",
      free: true,
      starter: true,
      pro: true,
      business: true,
    },
    // Resume Services
    {
      category: ar ? "خدمات السيرة الذاتية" : "Resume Services",
      label: ar ? "تحليل ATS للسيرة" : "ATS resume analysis",
      free: ar ? "مرة واحدة" : "Once",
      starter: true,
      pro: true,
      business: true,
    },
    {
      label: ar ? "تحسين السيرة بالذكاء الاصطناعي" : "AI resume enhancement",
      free: false,
      starter: true,
      pro: true,
      business: true,
    },
    {
      label: ar ? "بناء السيرة الذاتية" : "Resume builder",
      free: false,
      starter: true,
      pro: true,
      business: true,
    },
    {
      label: ar ? "تصدير بصيغة DOCX" : "Export to DOCX",
      free: false,
      starter: true,
      pro: true,
      business: true,
    },
    // Interview
    {
      category: ar ? "المقابلات الذكية" : "AI Interviews",
      label: ar ? "مقابلات ذكية بالصوت" : "Voice AI interviews",
      free: false,
      starter: true,
      pro: true,
      business: true,
    },
    {
      label: ar ? "تقييم الأداء التفصيلي" : "Detailed performance review",
      free: false,
      starter: true,
      pro: true,
      business: true,
    },
    {
      label: ar ? "سجل المقابلات السابقة" : "Interview history",
      free: false,
      starter: true,
      pro: true,
      business: true,
    },
    // Marketing
    {
      category: ar ? "التسويق والتقديم" : "Marketing & Outreach",
      label: ar ? "توليد إيميلات بالذكاء الاصطناعي" : "AI email generation",
      free: false,
      starter: true,
      pro: true,
      business: true,
    },
    {
      label: ar ? "إرسال جماعي عبر Gmail" : "Bulk Gmail sending",
      free: false,
      starter: true,
      pro: true,
      business: true,
    },
    {
      label: ar ? "ربط حساب Gmail" : "Gmail integration",
      free: false,
      starter: true,
      pro: true,
      business: true,
    },
    // Job Search
    {
      category: ar ? "البحث عن الوظائف" : "Job Search",
      label: ar ? "البحث عن الوظائف" : "Job search",
      free: true,
      starter: true,
      pro: true,
      business: true,
    },
    {
      label: ar ? "حفظ الوظائف المفضلة" : "Save favorite jobs",
      free: true,
      starter: true,
      pro: true,
      business: true,
    },
    {
      label: ar ? "نسبة المطابقة الذكية" : "Smart match score",
      free: true,
      starter: true,
      pro: true,
      business: true,
    },
    // Support
    {
      category: ar ? "الدعم" : "Support",
      label: ar ? "دعم عبر البريد" : "Email support",
      free: true,
      starter: true,
      pro: true,
      business: true,
    },
    {
      label: ar ? "دعم ذو أولوية" : "Priority support",
      free: false,
      starter: false,
      pro: true,
      business: true,
    },
  ];

  const renderCell = (value: CellValue) => {
    if (value === true) {
      return (
        <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary/10">
          <Check size={14} className="text-primary" strokeWidth={3} />
        </span>
      );
    }
    if (value === false) {
      return (
        <span className="inline-flex items-center justify-center size-6 rounded-full bg-muted">
          <X size={14} className="text-muted-foreground/50" strokeWidth={2} />
        </span>
      );
    }
    return <span className="text-sm font-semibold text-foreground">{value}</span>;
  };

  return (
    <section className="py-16 md:py-24" dir={ar ? "rtl" : "ltr"} ref={ref}>
      <div className="container max-w-5xl">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">
            {ar ? "مقارنة تفصيلية للباقات" : "Detailed Plan Comparison"}
          </h2>
          <p className="text-muted-foreground font-body text-sm max-w-lg mx-auto">
            {ar
              ? "اطّلع على جميع المزايا المتوفرة في كل باقة واختر ما يناسبك"
              : "See all features available in each plan and choose what suits you"}
          </p>
        </motion.div>

        <motion.div
          className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {/* Header */}
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-start font-display font-semibold text-foreground px-5 py-4 min-w-[200px]">
                    {ar ? "المزايا" : "Features"}
                  </th>
                  {plans.map((plan) => {
                    const Icon = plan.icon;
                    return (
                      <th
                        key={plan.key}
                        className={`px-4 py-4 text-center min-w-[120px] ${
                          plan.highlight
                            ? "bg-primary/5 relative"
                            : ""
                        }`}
                      >
                        {plan.highlight && (
                          <div className="absolute -top-0 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-[10px] font-display font-bold rounded-b-lg">
                            {ar ? "الأفضل" : "Best"}
                          </div>
                        )}
                        <div className="flex flex-col items-center gap-1.5">
                          <Icon size={18} className={plan.color} />
                          <span className="font-display font-bold text-foreground text-sm">{plan.name}</span>
                          <span className="text-xs text-muted-foreground font-body">{plan.price}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {features.map((feature, i) => (
                  <>
                    {feature.category && (
                      <tr key={`cat-${i}`}>
                        <td
                          colSpan={5}
                          className="px-5 pt-5 pb-2 text-xs font-display font-bold text-muted-foreground uppercase tracking-wider bg-muted/20"
                        >
                          {feature.category}
                        </td>
                      </tr>
                    )}
                    <tr
                      key={i}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-body text-foreground">
                        {feature.label}
                      </td>
                      {(["free", "starter", "pro", "business"] as const).map((planKey) => (
                        <td
                          key={planKey}
                          className={`px-4 py-3.5 text-center ${
                            planKey === "pro" ? "bg-primary/[0.02]" : ""
                          }`}
                        >
                          {renderCell(feature[planKey])}
                        </td>
                      ))}
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingComparisonTable;
