import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, Search, Sparkles, Send, Users, ListFilter, Mic, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const HowItWorksSection = () => {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [audience, setAudience] = useState<"seeker" | "recruiter">("seeker");

  const seekerSteps = [
    {
      icon: Upload,
      title: ar ? "ارفع سيرتك الذاتية" : "Upload Your Resume",
      description: ar
        ? "أسقط ملفك بصيغة PDF أو Word ودع الذكاء الاصطناعي يقرأ كل سطر ويفهم خبراتك ومهاراتك."
        : "Drop your PDF or Word file and let AI read every line, understanding your experience and skills.",
      highlight: ar ? "يدعم العربية والإنجليزية" : "Supports Arabic & English",
    },
    {
      icon: Search,
      title: ar ? "تحليل شامل بعين الخبير" : "Get Expert-Level Analysis",
      description: ar
        ? "نقيّم سيرتك عبر ١٠ معايير تشمل توافق ATS، الكلمات المفتاحية، الإنجازات، والتنسيق."
        : "We evaluate your resume across 10 criteria including ATS compatibility, keywords, achievements, and formatting.",
      highlight: ar ? "١٠ محاور تقييم" : "10 evaluation criteria",
    },
    {
      icon: Sparkles,
      title: ar ? "تحسين ذكي فوري" : "Enhance with AI",
      description: ar
        ? "بنقرة واحدة، يعيد الذكاء الاصطناعي صياغة كل قسم بأسلوب احترافي يبرز إنجازاتك."
        : "With one click, AI rewrites each section professionally, highlighting your achievements.",
      highlight: ar ? "إعادة صياغة احترافية" : "Professional rewriting",
    },
    {
      icon: Send,
      title: ar ? "تقدّم للوظائف بذكاء" : "Apply Smarter",
      description: ar
        ? "أنشئ رسائل تقديم مخصصة وأرسل سيرتك مباشرة لعشرات الشركات — كل شيء من مكان واحد."
        : "Create tailored application emails and send your resume directly to dozens of companies — all from one place.",
      highlight: ar ? "إرسال جماعي بنقرة" : "Bulk send in one click",
    },
  ];

  const recruiterSteps = [
    {
      icon: Upload,
      title: ar ? "ارفع سير المرشحين" : "Upload Candidates",
      description: ar
        ? "ارفع سير المرشحين الذاتية بصيغة PDF أو Word والنظام يستخرج البيانات تلقائياً."
        : "Upload candidate resumes in PDF or Word format and the system extracts data automatically.",
      highlight: ar ? "استخراج بيانات تلقائي" : "Auto data extraction",
    },
    {
      icon: Search,
      title: ar ? "تحليل وتقييم تلقائي" : "Auto Analysis & Scoring",
      description: ar
        ? "كل مرشح يحصل على درجة ATS وتقرير مهارات وملاءمة وظيفية تلقائياً."
        : "Every candidate gets an ATS score, skills report, and job fit assessment automatically.",
      highlight: ar ? "تقييم ATS دقيق" : "Precise ATS scoring",
    },
    {
      icon: ListFilter,
      title: ar ? "فلترة وبحث ذكي" : "Smart Search & Filter",
      description: ar
        ? "ابحث بالمهارات أو الخبرة أو المسمى الوظيفي وصفّي المرشحين الأنسب فوراً."
        : "Search by skills, experience, or job title and filter the best-fit candidates instantly.",
      highlight: ar ? "بحث بالكلمات المفتاحية" : "Keyword search",
    },
    {
      icon: CheckCircle2,
      title: ar ? "قابل ووظّف" : "Interview & Hire",
      description: ar
        ? "أجرِ مقابلات ذكية بأسئلة مخصصة لكل وظيفة واتخذ قرار التوظيف بثقة."
        : "Conduct smart interviews with custom questions per role and make confident hiring decisions.",
      highlight: ar ? "مقابلات بالذكاء الاصطناعي" : "AI-powered interviews",
    },
  ];

  const steps = audience === "seeker" ? seekerSteps : recruiterSteps;

  return (
    <section id="how-it-works" className="py-24 md:py-32 relative" dir={ar ? "rtl" : "ltr"}>
      <div className="container">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-5 tracking-tight">
            {ar ? (
              <>كيف يعمل <span className="text-primary">TALENTRY</span>؟</>
            ) : (
              <>How <span className="text-primary">TALENTRY</span> Works</>
            )}
          </h2>
          <p className="text-muted-foreground font-body max-w-lg mx-auto text-lg mb-8">
            {ar ? "٤ خطوات بسيطة — كل خطوة مدعومة بالذكاء الاصطناعي" : "4 simple steps — every step powered by AI"}
          </p>

          {/* Audience toggle */}
          <div className="inline-flex items-center rounded-2xl bg-muted/60 p-1 border border-border">
            <button
              onClick={() => setAudience("seeker")}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-display font-semibold transition-all ${
                audience === "seeker"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ar ? "الباحث عن عمل" : "Job Seeker"}
            </button>
            <button
              onClick={() => setAudience("recruiter")}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-display font-semibold transition-all ${
                audience === "recruiter"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ar ? "مسؤول التوظيف" : "Recruiter"}
            </button>
          </div>
        </motion.div>

        <motion.div
          key={audience}
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {steps.map((step, i) => (
            <motion.div
              key={i}
              className={`relative flex flex-col md:flex-row items-start gap-6 md:gap-10 ${i < steps.length - 1 ? "mb-8 md:mb-0 pb-8 md:pb-16" : ""}`}
              initial={{ opacity: 0, x: ar ? 30 : -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
            >
              {/* Number + Line */}
              <div className="flex flex-col items-center shrink-0">
                <div className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <step.icon size={24} className="text-primary" />
                  <div className={`absolute -top-2 ${ar ? "-left-2" : "-right-2"} w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-display font-bold shadow-md`}>
                    {i + 1}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block w-px h-full bg-gradient-to-b from-primary/20 to-transparent mt-3" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <h3 className="text-xl font-display font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground font-body leading-relaxed mb-3 max-w-md">{step.description}</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-primary bg-primary/8 px-3 py-1 rounded-full">
                  {step.highlight}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
