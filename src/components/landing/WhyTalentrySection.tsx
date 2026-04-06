import { motion } from "framer-motion";
import { X, Check, Zap, TrendingUp, Clock, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const WhyTalentrySection = () => {
  const { language } = useLanguage();
  const ar = language === "ar";

  const comparisons = [
    {
      traditional: ar ? "ترسل سيرتك لعشرات الشركات يدوياً" : "Manually send resumes to dozens of companies",
      talentry: ar ? "إرسال جماعي ذكي بنقرة واحدة" : "Smart bulk sending with one click",
    },
    {
      traditional: ar ? "تتساءل لماذا لا تحصل على ردود" : "Wonder why you never get callbacks",
      talentry: ar ? "تعرف بالضبط لماذا — وتصلح المشكلة" : "Know exactly why — and fix the problem",
    },
    {
      traditional: ar ? "تعيد كتابة سيرتك بالتجربة والخطأ" : "Rewrite your resume by trial and error",
      talentry: ar ? "تحسين احترافي فوري بالذكاء الاصطناعي" : "Instant professional AI enhancement",
    },
    {
      traditional: ar ? "تذهب للمقابلة بدون تحضير كافٍ" : "Go to interviews underprepared",
      talentry: ar ? "تتدرب مع مُحاور ذكي يقيّم أداءك" : "Practice with AI interviewer that evaluates you",
    },
    {
      traditional: ar ? "لا تعرف الراتب المناسب لمستواك" : "Don't know the right salary for your level",
      talentry: ar ? "تقديرات رواتب دقيقة حسب خبرتك" : "Accurate salary estimates based on your experience",
    },
  ];

  const benefits = [
    {
      icon: TrendingUp,
      seeker: ar ? "فرص مقابلة أعلى بنسبة ٣×" : "3x Higher Interview Rates",
      recruiter: ar ? "توظيف أسرع بنسبة ٦٠٪" : "60% Faster Hiring",
    },
    {
      icon: Clock,
      seeker: ar ? "وفّر ساعات من التقديم اليدوي" : "Save Hours of Manual Applications",
      recruiter: ar ? "قلّل وقت الفرز بنسبة ٧٠٪" : "Reduce Screening Time by 70%",
    },
    {
      icon: ShieldCheck,
      seeker: ar ? "سيرة ذاتية أقوى ومتوافقة مع ATS" : "Stronger ATS-Compatible Resume",
      recruiter: ar ? "جودة مرشحين أعلى في القائمة المختصرة" : "Higher Quality Shortlisted Candidates",
    },
  ];

  return (
    <section className="py-24 md:py-32 relative" dir={ar ? "rtl" : "ltr"}>
      <div className="container max-w-5xl">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-sm font-display font-medium mb-5">
            <Zap size={14} />
            {ar ? "الفرق واضح" : "The Difference is Clear"}
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-5 tracking-tight">
            {ar ? (
              <>لماذا <span className="text-primary">TALENTRY</span>؟</>
            ) : (
              <>Why <span className="text-primary">TALENTRY</span>?</>
            )}
          </h2>
          <p className="text-muted-foreground font-body max-w-lg mx-auto text-lg">
            {ar ? "الفرق بين البحث التقليدي عن وظيفة وبين البحث الذكي" : "The difference between traditional job hunting and smart job hunting"}
          </p>
        </motion.div>

        {/* Comparison table */}
        <motion.div
          className="rounded-2xl border border-border overflow-hidden shadow-elevated mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.6 }}
        >
          <div className="grid grid-cols-2">
            <div className="p-5 text-center font-display font-semibold text-muted-foreground text-sm md:text-base border-b border-border bg-destructive/3">
              {ar ? "❌ الطريقة التقليدية" : "❌ Traditional Way"}
            </div>
            <div className="p-5 text-center font-display font-bold text-primary text-sm md:text-base border-b border-border bg-primary/3">
              ✨ TALENTRY
            </div>
          </div>
          {comparisons.map((row, i) => (
            <motion.div
              key={i}
              className={`grid grid-cols-2 ${i < comparisons.length - 1 ? "border-b border-border" : ""}`}
              initial={{ opacity: 0, x: ar ? 20 : -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.06, duration: 0.4 }}
            >
              <div className="p-4 md:p-5 flex items-center gap-3 bg-background">
                <X size={14} className="text-destructive shrink-0 opacity-60" />
                <span className="text-sm font-body text-muted-foreground">{row.traditional}</span>
              </div>
              <div className="p-4 md:p-5 flex items-center gap-3 bg-card border-s border-border">
                <Check size={14} className="text-success shrink-0" />
                <span className="text-sm font-body text-foreground font-medium">{row.talentry}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Dual benefits */}
        <div className="grid md:grid-cols-3 gap-5">
          {benefits.map((b, i) => (
            <motion.div
              key={i}
              className="rounded-2xl border border-border bg-card p-6 text-center hover:shadow-elevated transition-shadow"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <b.icon size={22} className="text-primary" />
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground font-body mb-1">{ar ? "للباحثين عن عمل" : "Job Seekers"}</p>
                  <p className="text-sm font-display font-semibold text-foreground">{b.seeker}</p>
                </div>
                <div className="h-px bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground font-body mb-1">{ar ? "لمسؤولي التوظيف" : "Recruiters"}</p>
                  <p className="text-sm font-display font-semibold text-foreground">{b.recruiter}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyTalentrySection;
