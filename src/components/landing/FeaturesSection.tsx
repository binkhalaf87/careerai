import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Sparkles, FileText, Mic, Mail, ArrowUpRight,
  Users, Search, ListFilter, Brain, LayoutDashboard, UserCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";

const FeaturesSection = () => {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [audience, setAudience] = useState<"seeker" | "recruiter">("seeker");

  const seekerFeatures = [
    {
      icon: BarChart3,
      title: ar ? "تحليل السيرة الذاتية" : "AI Resume Analysis",
      description: ar
        ? "اكتشف كيف تراك أنظمة ATS ومسؤولو التوظيف. تقرير مفصّل بـ ١٠ محاور مع درجة دقيقة وخطة تحسين."
        : "Discover how ATS systems and recruiters see you. A detailed 10-axis report with precise scoring and improvement plan.",
      link: "/analysis",
      iconBg: "bg-blue-500/10 text-blue-600",
      gradient: "from-blue-500/10 to-indigo-500/10",
    },
    {
      icon: Sparkles,
      title: ar ? "إعادة كتابة السيرة (ATS)" : "ATS Resume Rewrite",
      description: ar
        ? "الذكاء الاصطناعي يعيد صياغة كل قسم بكلمات مفتاحية دقيقة وأسلوب يبرز إنجازاتك ويجتاز أنظمة الفلترة."
        : "AI rewrites every section with precise keywords and a style that highlights achievements and passes ATS filters.",
      link: "/enhance",
      iconBg: "bg-violet-500/10 text-violet-600",
      gradient: "from-violet-500/10 to-purple-500/10",
    },
    {
      icon: FileText,
      title: ar ? "بناء السيرة الذاتية" : "Resume Builder",
      description: ar
        ? "ابنِ سيرة ذاتية احترافية من الصفر بمساعدة الذكاء الاصطناعي متوافقة مع أنظمة ATS."
        : "Build a professional resume from scratch with AI assistance, fully ATS-compatible.",
      link: "/builder",
      iconBg: "bg-emerald-500/10 text-emerald-600",
      gradient: "from-emerald-500/10 to-teal-500/10",
    },
    {
      icon: Search,
      title: ar ? "البحث عن الوظائف" : "Job Matching Engine",
      description: ar
        ? "ابحث عن وظائف تتناسب مع مهاراتك وخبراتك، مع تقييم مطابقة كل وظيفة لملفك."
        : "Find jobs that match your skills and experience, with a match score for each opportunity.",
      link: "/jobs",
      iconBg: "bg-cyan-500/10 text-cyan-600",
      gradient: "from-cyan-500/10 to-blue-500/10",
    },
    {
      icon: Mail,
      title: ar ? "التقديم الذكي / SmartSend" : "Auto Apply / SmartSend",
      description: ar
        ? "أرسل سيرتك مباشرة لعشرات الشركات برسائل مخصصة — بنقرة واحدة."
        : "Send your resume directly to dozens of companies with personalized emails — in one click.",
      link: "/marketing",
      iconBg: "bg-rose-500/10 text-rose-600",
      gradient: "from-rose-500/10 to-pink-500/10",
    },
    {
      icon: Mic,
      title: ar ? "التحضير للمقابلات" : "AI Interview Practice",
      description: ar
        ? "تدرّب مع مُحاور ذكي يحاكي بيئة المقابلة الحقيقية ويعطيك ملاحظات فورية."
        : "Practice with an AI interviewer that simulates real interviews and gives instant feedback.",
      link: "/dashboard/interview-avatar",
      iconBg: "bg-amber-500/10 text-amber-600",
      gradient: "from-amber-500/10 to-orange-500/10",
    },
  ];

  const recruiterFeatures = [
    {
      icon: Brain,
      title: ar ? "تحليل المرشحين بالذكاء الاصطناعي" : "AI Candidate Analysis",
      description: ar
        ? "حلّل كل مرشح بتقرير شامل يكشف نقاط القوة والضعف والمهارات المستخرجة تلقائياً."
        : "Analyze each candidate with a comprehensive report revealing strengths, weaknesses, and auto-extracted skills.",
      link: "/signup",
      iconBg: "bg-violet-500/10 text-violet-600",
      gradient: "from-violet-500/10 to-purple-500/10",
    },
    {
      icon: BarChart3,
      title: ar ? "تقييم ATS وترتيب المرشحين" : "ATS Score & Candidate Ranking",
      description: ar
        ? "درجة ATS دقيقة لكل مرشح مع ترتيب تلقائي حسب مدى ملاءمته للوظيفة."
        : "Precise ATS score for each candidate with automatic ranking based on job fit.",
      link: "/signup",
      iconBg: "bg-blue-500/10 text-blue-600",
      gradient: "from-blue-500/10 to-indigo-500/10",
    },
    {
      icon: ListFilter,
      title: ar ? "بحث وفلترة بالكلمات المفتاحية" : "Keyword Search & Filter",
      description: ar
        ? "ابحث في قاعدة المرشحين بالمهارات والخبرات والمسمى الوظيفي — نتائج فورية."
        : "Search your candidate database by skills, experience, and job title — instant results.",
      link: "/signup",
      iconBg: "bg-emerald-500/10 text-emerald-600",
      gradient: "from-emerald-500/10 to-teal-500/10",
    },
    {
      icon: UserCheck,
      title: ar ? "مطابقة المرشحين مع الوظائف" : "Candidate-Job Matching",
      description: ar
        ? "المنصة تطابق المرشحين تلقائياً مع وظائفك المفتوحة وتعرض درجة التوافق."
        : "The platform automatically matches candidates to your open positions and shows compatibility scores.",
      link: "/signup",
      iconBg: "bg-cyan-500/10 text-cyan-600",
      gradient: "from-cyan-500/10 to-blue-500/10",
    },
    {
      icon: Mic,
      title: ar ? "نظام المقابلات الذكي" : "AI Interview System",
      description: ar
        ? "أنشئ أسئلة مقابلة مخصصة لكل وظيفة وقيّم إجابات المرشحين بالذكاء الاصطناعي."
        : "Generate custom interview questions per job and evaluate candidate answers with AI.",
      link: "/signup",
      iconBg: "bg-amber-500/10 text-amber-600",
      gradient: "from-amber-500/10 to-orange-500/10",
    },
    {
      icon: LayoutDashboard,
      title: ar ? "لوحة تحكم التوظيف" : "Recruitment Dashboard",
      description: ar
        ? "لوحة تحكم شاملة لإدارة الوظائف والمرشحين والمقابلات من مكان واحد."
        : "Comprehensive dashboard to manage jobs, candidates, and interviews from one place.",
      link: "/signup",
      iconBg: "bg-rose-500/10 text-rose-600",
      gradient: "from-rose-500/10 to-pink-500/10",
    },
  ];

  const features = audience === "seeker" ? seekerFeatures : recruiterFeatures;

  return (
    <section id="features" className="py-24 md:py-32 bg-card/50 relative" dir={ar ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.03),transparent_70%)]" />

      <div className="container relative">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-5 tracking-tight">
            {ar ? (
              <>منظومة متكاملة <span className="text-primary">لكل طرف</span></>
            ) : (
              <>A Complete Platform <span className="text-primary">for Everyone</span></>
            )}
          </h2>
          <p className="text-muted-foreground font-body max-w-lg mx-auto text-lg mb-8">
            {ar
              ? "أدوات ذكية للباحثين عن عمل ومسؤولي التوظيف على حدٍّ سواء"
              : "Smart tools for job seekers and recruiters alike"}
          </p>

          {/* Audience toggle */}
          <div className="inline-flex items-center rounded-2xl bg-muted/60 p-1 border border-border">
            <button
              onClick={() => setAudience("seeker")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-display font-semibold transition-all ${
                audience === "seeker"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles size={15} />
              {ar ? "للباحثين عن عمل" : "For Job Seekers"}
            </button>
            <button
              onClick={() => setAudience("recruiter")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-display font-semibold transition-all ${
                audience === "recruiter"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users size={15} />
              {ar ? "لمسؤولي التوظيف" : "For Recruiters"}
            </button>
          </div>
        </motion.div>

        <motion.div
          key={audience}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              className="group relative p-7 rounded-2xl bg-background border border-border hover:border-primary/20 transition-all duration-500 hover:shadow-elevated"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
            >
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

              <div className="relative">
                <div className="flex items-start justify-between mb-5">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${feature.iconBg}`}>
                    <feature.icon size={22} />
                  </div>
                  <Link to={feature.link} className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ArrowUpRight size={18} className="text-primary" />
                  </Link>
                </div>
                <h3 className="font-display font-bold text-foreground mb-3 text-lg">{feature.title}</h3>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA under features */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <Button size="lg" className="shadow-lg shadow-primary/20 gap-2" asChild>
            <Link to="/signup">
              {audience === "seeker"
                ? ar ? "ابدأ ببناء مسيرتك المهنية" : "Start Building Your Career"
                : ar ? "ابدأ بتوظيف أذكى" : "Start Hiring Smarter"
              }
              <ArrowUpRight size={16} />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection;


