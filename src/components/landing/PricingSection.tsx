import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Coins, Sparkles, Zap, Shield, Star, Loader2, Crown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PricingSection = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const ar = language === "ar";
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [buyingPackage, setBuyingPackage] = useState<string | null>(null);

  const handleBuy = async (packageId: string) => {
    if (!user) {
      navigate("/signup");
      return;
    }
    setBuyingPackage(packageId);
    try {
      const { data, error } = await supabase.functions.invoke("paymob-checkout", {
        body: { packageId },
      });
      if (error) throw error;
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error("No checkout URL");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error(ar ? "فشل إنشاء جلسة الدفع" : "Failed to create checkout session");
    } finally {
      setBuyingPackage(null);
    }
  };

  const plans = [
    {
      name: ar ? "مجاني" : "Free",
      points: 0,
      price: "0",
      priceLabel: ar ? "مجاناً" : "Free",
      period: "",
      description: ar ? "جرّب المنصة بتحليل مجاني" : "Try with a free analysis",
      icon: Star,
      features: ar
        ? ["تحليل سيرة ذاتية واحد مجاناً", "تقرير ATS كامل", "توصيات تحسين"]
        : ["1 free resume analysis", "Full ATS report", "Improvement tips"],
      cta: ar ? "ابدأ مجاناً" : "Start Free",
      popular: false,
      gradient: "from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800",
      accentColor: "text-slate-500",
      packageId: null as string | null,
    },
    {
      name: ar ? "المبتدئ" : "Starter",
      points: 30,
      price: "29",
      period: ar ? "/شهرياً" : "/mo",
      description: ar ? "مثالية للبداية" : "Great to get started",
      icon: Zap,
      features: ar
        ? ["30 نقطة شهرياً", "تحليل السيرة الذاتية", "تحسين بالذكاء الاصطناعي", "مقابلات ذكية", "تسويق السيرة"]
        : ["30 credits/month", "Resume analysis", "AI enhancement", "AI interviews", "Resume marketing"],
      cta: ar ? "اشترك الآن" : "Subscribe",
      popular: false,
      gradient: "from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40",
      accentColor: "text-blue-500",
      packageId: "starter",
    },
    {
      name: ar ? "المحترف" : "Pro",
      points: 100,
      price: "79",
      period: ar ? "/شهرياً" : "/mo",
      description: ar ? "الأفضل للباحثين عن عمل" : "Best for job seekers",
      icon: Sparkles,
      features: ar
        ? ["100 نقطة شهرياً", "تحليل السيرة الذاتية", "تحسين بالذكاء الاصطناعي", "مقابلات ذكية", "تسويق السيرة", "دعم ذو أولوية"]
        : ["100 credits/month", "Resume analysis", "AI enhancement", "AI interviews", "Resume marketing", "Priority support"],
      cta: ar ? "اشترك الآن" : "Subscribe",
      popular: true,
      gradient: "from-primary/5 to-primary/10",
      accentColor: "text-primary",
      packageId: "pro",
    },
    {
      name: ar ? "الأعمال" : "Business",
      points: 300,
      price: "149",
      period: ar ? "/شهرياً" : "/mo",
      description: ar ? "للاستخدام المكثف" : "For power users",
      icon: Crown,
      features: ar
        ? ["300 نقطة شهرياً", "تحليل السيرة الذاتية", "تحسين بالذكاء الاصطناعي", "مقابلات ذكية", "تسويق السيرة", "دعم ذو أولوية"]
        : ["300 credits/month", "Resume analysis", "AI enhancement", "AI interviews", "Resume marketing", "Priority support"],
      cta: ar ? "اشترك الآن" : "Subscribe",
      popular: false,
      gradient: "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
      accentColor: "text-amber-500",
      packageId: "business",
    },
  ];


  return (
    <section id="pricing" className="py-24 md:py-32 relative overflow-hidden" dir={ar ? "rtl" : "ltr"}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/3 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container relative" ref={ref}>
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-5">
            <Coins size={14} />
            {ar ? "تحليل مجاني + نقاط شهرية" : "Free Analysis + Monthly Credits"}
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-4 tracking-tight">
            {ar ? "ابدأ مجاناً، ثم اختر باقتك" : "Start Free, Then Pick Your Plan"}
          </h2>
          <p className="text-muted-foreground font-body max-w-md mx-auto text-base leading-relaxed">
            {ar
              ? "حلّل سيرتك الذاتية مجاناً — ثم اشترك للحصول على نقاط شهرية لجميع الخدمات"
              : "Analyze your resume for free — then subscribe for monthly credits across all services"}
          </p>
        </motion.div>


        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            const isBuying = buyingPackage === plan.packageId;
            return (
              <motion.div
                key={i}
                className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 ${
                  plan.popular
                    ? "border-primary/50 shadow-lg shadow-primary/10 scale-[1.02]"
                    : "border-border hover:border-border/80 hover:shadow-md"
                } bg-gradient-to-b ${plan.gradient}`}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                whileHover={!plan.popular ? { y: -4 } : {}}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-1 bg-primary text-primary-foreground text-xs font-display font-semibold rounded-full shadow-md whitespace-nowrap">
                    <Sparkles size={11} />
                    {ar ? "الأكثر شعبية" : "Most Popular"}
                  </div>
                )}

                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`p-1.5 rounded-lg bg-background/60 ${plan.accentColor}`}>
                    <Icon size={15} strokeWidth={2.5} />
                  </div>
                  <h3 className="font-display font-semibold text-foreground text-sm">{plan.name}</h3>
                </div>

                <p className="text-xs text-muted-foreground font-body mb-5 leading-relaxed">{plan.description}</p>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1 mb-1">
                    {plan.price === "0" ? (
                      <span className="text-3xl font-display font-bold text-foreground">
                        {plan.priceLabel ?? "Free"}
                      </span>
                    ) : (
                      <>
                        <span className="text-3xl font-display font-bold text-foreground">{plan.price}</span>
                        <span className="text-muted-foreground font-body text-sm">
                          {ar ? "ر.س" : "SAR"}{plan.period}
                        </span>
                      </>
                    )}
                  </div>
                  {plan.points > 0 && (
                    <div className={`flex items-center gap-1.5 text-sm font-semibold ${plan.accentColor}`}>
                      <Coins size={13} />
                      <span>
                        {plan.points} {ar ? "نقطة/شهرياً" : "credits/mo"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="h-px bg-border/50 mb-5" />

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2.5 text-sm font-body text-foreground">
                      <span className="mt-0.5 shrink-0 size-4 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check size={10} className="text-primary" strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.packageId ? (
                  <Button
                    className={`w-full font-semibold transition-all ${
                      plan.popular ? "shadow-md hover:shadow-lg hover:shadow-primary/20" : ""
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                    disabled={isBuying}
                    onClick={() => handleBuy(plan.packageId!)}
                  >
                    {isBuying ? (
                      <><Loader2 size={14} className="animate-spin mr-2" />{ar ? "جاري التحويل..." : "Redirecting..."}</>
                    ) : (
                      plan.cta
                    )}
                  </Button>
                ) : (
                  <Button
                    className="w-full font-semibold"
                    variant="outline"
                    asChild
                  >
                    <Link to={user ? "/dashboard" : "/signup"}>{plan.cta}</Link>
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>

        <motion.p
          className="text-center text-xs text-muted-foreground mt-10 font-body"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          {ar
            ? "✓ تحليل أول مجاني · ✓ دفع آمن · ✓ بدون رسوم خفية · ✓ إلغاء في أي وقت"
            : "✓ First analysis free · ✓ Secure payment · ✓ No hidden fees · ✓ Cancel anytime"}
        </motion.p>
      </div>
    </section>
  );
};

export default PricingSection;
