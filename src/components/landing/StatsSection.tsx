import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}{suffix}
    </span>
  );
}

const StatsSection = () => {
  const { language } = useLanguage();
  const ar = language === "ar";

  const stats = [
    { value: 6, suffix: "+", label: ar ? "أدوات ذكاء اصطناعي للباحثين" : "AI Tools for Job Seekers" },
    { value: 60, suffix: "s", label: ar ? "ثانية لتحليل السيرة الذاتية" : "Seconds to Analyze" },
    { value: 5, suffix: "+", label: ar ? "أدوات ذكية للتوظيف" : "Smart Hiring Tools" },
    { value: 24, suffix: "/7", label: ar ? "متاح على مدار الساعة" : "Always Available" },
  ];

  return (
    <section className="py-20 md:py-24 relative overflow-hidden" dir={ar ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/3 to-primary/5" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />

      <div className="container relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 max-w-4xl mx-auto">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <div className="text-4xl md:text-5xl font-display font-extrabold text-primary mb-2 tabular-nums">
                <AnimatedNumber target={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-sm text-muted-foreground font-body font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
