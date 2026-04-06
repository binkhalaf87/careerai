import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const FAQSection = () => {
  const { language } = useLanguage();
  const ar = language === "ar";

  const faqs = ar ? [
    {
      q: "ما هي درجة ATS ولماذا هي مهمة؟",
      a: "أغلب الشركات تستخدم أنظمة تتبع المتقدمين (ATS) لفلترة السير الذاتية تلقائياً قبل أن يراها أي إنسان. درجة ATS تخبرك بمدى قدرة سيرتك على تجاوز هذه الفلاتر. نحن نقيّم التنسيق والكلمات المفتاحية والهيكل والمحتوى — بنفس الطريقة التي تعمل بها هذه الأنظمة.",
    },
    {
      q: "ما صيغ الملفات المدعومة؟",
      a: "ندعم صيغتَي PDF و DOCX. السير الذاتية بالعربية والإنجليزية مدعومة بالكامل — الذكاء الاصطناعي يكتشف اللغة تلقائياً ويحللها بنفس الدقة.",
    },
    {
      q: "كيف يحسّن الذكاء الاصطناعي سيرتي الذاتية؟",
      a: "يعيد الذكاء الاصطناعي صياغة أقسام سيرتك بلغة يفضلها مسؤولو التوظيف، ويضيف كلمات مفتاحية معيارية في مجالك، ويبرز إنجازاتك بأرقام قابلة للقياس — كل ذلك مع الحفاظ على معلوماتك الحقيقية دون اختلاق أي شيء.",
    },
    {
      q: "هل يمكنني إرسال سيرتي مباشرة للشركات؟",
      a: "نعم! يمكنك ربط حساب Gmail الخاص بك وإرسال رسائل تقديم احترافية مخصصة لكل شركة مباشرة من المنصة. كما يمكنك الإرسال الجماعي لعشرات الشركات بضغطة واحدة.",
    },
    {
      q: "هل بياناتي آمنة؟",
      a: "بالتأكيد. جميع البيانات مشفرة ومحمية. سيرتك الذاتية ومعلوماتك الشخصية لا تُشارك مع أي طرف ثالث ولا تُستخدم لأي غرض غير تحليلك الشخصي.",
    },
    {
      q: "كم تكلفة استخدام المنصة؟",
      a: "يمكنك البدء مجاناً بـ ١٠ نقاط تجريبية. بعد ذلك تشتري نقاط حسب حاجتك — بدون اشتراكات شهرية ملزمة. النقاط لا تنتهي صلاحيتها.",
    },
  ] : [
    {
      q: "What is an ATS score and why does it matter?",
      a: "Most companies use Applicant Tracking Systems (ATS) to automatically filter resumes before a human sees them. Your ATS score tells you how likely your resume is to pass these filters. We evaluate formatting, keywords, structure, and content — exactly like these systems do.",
    },
    {
      q: "What file formats are supported?",
      a: "We support PDF and DOCX formats. Both Arabic and English resumes are fully supported — our AI automatically detects the language and analyzes it with the same precision.",
    },
    {
      q: "How does AI improve my resume?",
      a: "Our AI rewrites your resume sections using recruiter-preferred language, adds industry-standard keywords, and highlights achievements with measurable metrics — all while preserving your real information without inventing anything.",
    },
    {
      q: "Can I send my resume directly to companies?",
      a: "Yes! You can connect your Gmail account and send professional, personalized application emails to each company directly from the platform. You can also bulk-send to dozens of companies with one click.",
    },
    {
      q: "Is my data secure?",
      a: "Absolutely. All data is encrypted and protected. Your resume and personal information are never shared with any third party or used for any purpose other than your personal analysis.",
    },
    {
      q: "How much does it cost?",
      a: "You can start free with 10 trial points. After that, buy points as you need — no mandatory monthly subscriptions. Points never expire.",
    },
  ];

  return (
    <section id="faq" className="py-24 md:py-32" dir={ar ? "rtl" : "ltr"}>
      <div className="container max-w-3xl">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-sm font-display font-medium mb-5">
            <HelpCircle size={14} />
            {ar ? "أسئلة شائعة" : "FAQ"}
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-5 tracking-tight">
            {ar ? "أسئلة تهمّك" : "Questions You Might Have"}
          </h2>
          <p className="text-muted-foreground font-body max-w-md mx-auto text-lg">
            {ar ? "كل ما تحتاج معرفته قبل أن تبدأ" : "Everything you need to know before getting started"}
          </p>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <AccordionItem
                value={`faq-${i}`}
                className="border border-border rounded-xl px-6 bg-card hover:shadow-card data-[state=open]:shadow-elevated transition-shadow duration-300"
              >
                <AccordionTrigger className="text-start font-display font-semibold text-foreground py-5 hover:no-underline text-[15px]">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground font-body text-sm leading-relaxed pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQSection;
