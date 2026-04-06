import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const TestimonialsSection = () => {
  const { language } = useLanguage();
  const ar = language === "ar";

  const testimonials = [
    {
      name: ar ? "أحمد الراشد" : "Ahmed Al-Rashid",
      role: ar ? "مهندس برمجيات" : "Software Engineer",
      text: ar
        ? "بعد تحليل سيرتي على TALENTRY اكتشفت أخطاء ما كنت أنتبه لها. خلال أسبوع واحد حصلت على ٣ مقابلات!"
        : "After analyzing my resume on TALENTRY, I discovered mistakes I never noticed. Within a week, I got 3 interview calls!",
      rating: 5,
    },
    {
      name: ar ? "سارة العتيبي" : "Sara Al-Otaibi",
      role: ar ? "مديرة تسويق" : "Marketing Manager",
      text: ar
        ? "ميزة إعادة الكتابة بالذكاء الاصطناعي حوّلت ملخصي المهني من عادي إلى استثنائي. الفرق كان واضح فوراً."
        : "The AI rewrite feature transformed my professional summary from generic to exceptional. The difference was immediately clear.",
      rating: 5,
    },
    {
      name: ar ? "خالد منصور" : "Khalid Mansour",
      role: ar ? "محلل بيانات" : "Data Analyst",
      text: ar
        ? "إرسال سيرتي مباشرة للشركات وفّر عليّ ساعات من العمل. قوالب الرسائل احترافية وفعّالة جداً."
        : "Sending my resume directly to companies saved me hours. The email templates are professional and highly effective.",
      rating: 5,
    },
  ];

  return (
    <section className="py-24 md:py-32 bg-card/50" dir={ar ? "rtl" : "ltr"}>
      <div className="container">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-5 tracking-tight">
            {ar ? (
              <>قصص نجاح <span className="text-primary">حقيقية</span></>
            ) : (
              <>Real <span className="text-primary">Success Stories</span></>
            )}
          </h2>
          <p className="text-muted-foreground font-body max-w-lg mx-auto text-lg">
            {ar ? "محترفون غيّروا مسارهم المهني مع TALENTRY" : "Professionals who transformed their careers with TALENTRY"}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((item, i) => (
            <motion.div
              key={item.name}
              className="relative p-7 rounded-2xl bg-background border border-border hover:shadow-elevated transition-shadow duration-300"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <Quote size={28} className="text-primary/15 mb-4" />

              <p className="text-muted-foreground font-body leading-relaxed mb-6 text-[15px]">
                {item.text}
              </p>

              <div className="flex items-center gap-1 mb-4">
                {[...Array(item.rating)].map((_, si) => (
                  <Star key={si} size={14} className="fill-amber-400 text-amber-400" />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-display font-bold text-sm">
                  {item.name.charAt(0)}
                </div>
                <div>
                  <div className="font-display font-semibold text-foreground text-sm">{item.name}</div>
                  <div className="text-xs text-muted-foreground font-body">{item.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
