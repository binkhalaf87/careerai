import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Briefcase, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const FinalCTASection = () => {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <section className="py-24 md:py-32 relative overflow-hidden" dir={ar ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/3 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08),transparent_60%)]" />

      <div className="container relative max-w-3xl">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary font-display font-semibold text-sm mb-8"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Sparkles size={14} />
            {ar ? "ابدأ رحلتك الآن" : "Start Your Journey Now"}
          </motion.div>

          <h2 className="text-3xl md:text-5xl lg:text-6xl font-display font-extrabold text-foreground mb-7 leading-tight tracking-tight">
            {ar ? (
              <>
                <span className="block">مسيرتك المهنية</span>
                <span className="block text-primary">تبدأ من هنا</span>
              </>
            ) : (
              <>
                <span className="block">Your Career Journey</span>
                <span className="block text-primary">Starts Here</span>
              </>
            )}
          </h2>

          <p className="text-lg md:text-xl text-muted-foreground font-body max-w-xl mx-auto mb-10 leading-relaxed">
            {ar
              ? "سواء كنت تبحث عن وظيفة أحلامك أو تبحث عن أفضل المواهب — TALENTRY هو شريكك الذكي."
              : "Whether you're searching for your dream job or the best talent — TALENTRY is your smart partner."}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Button size="lg" className="text-base px-8 h-14 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all font-semibold gap-2" asChild>
              <Link to="/signup">
                <Briefcase size={18} />
                {ar ? "ابدأ كباحث عن عمل" : "Start as Job Seeker"}
                <ArrowRight className={`${ar ? "rotate-180" : ""}`} size={16} />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 h-14 font-semibold gap-2 border-primary/20 hover:bg-primary/5" asChild>
              <Link to="/signup">
                <Users size={18} />
                {ar ? "ابدأ كمسؤول توظيف" : "Start as Recruiter"}
                <ArrowRight className={`${ar ? "rotate-180" : ""}`} size={16} />
              </Link>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground font-body">
            {ar ? "✓ بدون بطاقة ائتمان • ✓ ٣٠ نقطة مجانية عند التسجيل" : "✓ No credit card • ✓ 30 free credits on signup"}
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTASection;


