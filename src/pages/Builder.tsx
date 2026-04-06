import { useMemo, useState, useCallback, useEffect } from "react";
import { deductPoints } from "@/lib/points";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  FileText,
  Briefcase,
  GraduationCap,
  Award,
  Languages,
  UserCircle2,
  FileDown,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ExperienceEditor from "@/components/builder/ExperienceEditor";
import {
  parseExperienceIntoBullets,
  experienceRolesToText,
  type ExperienceRole,
} from "@/lib/resume-utils";

const Builder = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isRTL = language === "ar";

  const [saving, setSaving] = useState(false);
  const [improvingSection, setImprovingSection] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    title: "",
    summary: "",
    experience: "",
    skills: "",
    education: "",
    certifications: "",
    languages: "",
  });

  // Track original values for restore
  const [originals, setOriginals] = useState<Record<string, string>>({});

  // Structured experience roles derived from experience text
  const [experienceRoles, setExperienceRoles] = useState<ExperienceRole[]>([]);
  const [experienceInitialized, setExperienceInitialized] = useState(false);

  // Sync experience text → roles when text changes externally (e.g. AI improve)
  useEffect(() => {
    if (!experienceInitialized && formData.experience) {
      setExperienceRoles(parseExperienceIntoBullets(formData.experience));
      setExperienceInitialized(true);
    }
  }, [formData.experience, experienceInitialized]);

  const handleExperienceRolesChange = useCallback((roles: ExperienceRole[]) => {
    setExperienceRoles(roles);
    setFormData(prev => ({ ...prev, experience: experienceRolesToText(roles) }));
  }, []);

  const sections = [
    {
      id: "name",
      label: t.builder.fullName,
      type: "input" as const,
      placeholder: isRTL ? "مثال: ماجد الحربي" : "John Doe",
      hint: isRTL ? "اكتب اسمك كما تريد أن يظهر في السيرة الذاتية." : "Write your full name exactly as you want it to appear on your resume.",
      icon: UserCircle2,
    },
    {
      id: "title",
      label: t.builder.jobTitle,
      type: "input" as const,
      placeholder: isRTL ? "مثال: أخصائي دعم فني" : "Senior Software Engineer",
      hint: isRTL ? "اكتب المسمى المستهدف أو الحالي بشكل واضح ومهني." : "Add your current or target job title in a clear professional way.",
      icon: Briefcase,
    },
    {
      id: "summary",
      label: t.builder.professionalSummary,
      type: "textarea" as const,
      placeholder: isRTL ? "مختص بخبرة في ... أتميز في ... وأسعى إلى ..." : "A results-driven professional with experience in...",
      hint: isRTL ? "هذا القسم يعطي أول انطباع. اجعله مختصرًا وقويًا." : "This is your first impression. Keep it concise and impactful.",
      icon: FileText,
    },
    {
      id: "experience",
      label: t.builder.workExperience,
      type: "experience" as const,
      placeholder: isRTL ? "اسم الشركة — المسمى الوظيفي\n2020 - حتى الآن\n• قدت فريقًا...\n• حسّنت العمليات..." : "Company Name — Role\n2020-Present\n• Led a team of...\n• Improved process...",
      hint: isRTL ? "اكتب الخبرات بصيغة إنجازات، وليس مجرد مهام. كل نقطة يمكن تحسينها بالذكاء الاصطناعي." : "Write accomplishments, not just responsibilities. Each bullet can be AI-improved individually.",
      icon: Briefcase,
    },
    {
      id: "skills",
      label: t.builder.skills,
      type: "textarea" as const,
      placeholder: isRTL ? "إدارة المشاريع، Excel، Power BI، خدمة العملاء..." : "JavaScript, React, Node.js, Python...",
      hint: isRTL ? "اجمع المهارات المهمة المرتبطة بالدور المستهدف." : "List the most relevant skills for your target role.",
      icon: CheckCircle2,
    },
    {
      id: "education",
      label: t.builder.education,
      type: "textarea" as const,
      placeholder: isRTL ? "بكالوريوس إدارة أعمال\nجامعة الملك سعود، 2020" : "Bachelor of Computer Science\nKing Saud University, 2018",
      hint: isRTL ? "اكتب المؤهل، الجهة التعليمية، وسنة التخرج إن وجدت." : "Include degree, institution, and graduation year if available.",
      icon: GraduationCap,
    },
    {
      id: "certifications",
      label: t.builder.certifications,
      type: "textarea" as const,
      placeholder: isRTL ? "PMP\nGoogle Data Analytics" : "AWS Certified Solutions Architect",
      hint: isRTL ? "أضف الشهادات المهنية أو الدورات القوية فقط." : "Include only strong certifications or relevant courses.",
      icon: Award,
    },
    {
      id: "languages",
      label: t.builder.languages,
      type: "input" as const,
      placeholder: isRTL ? "العربية (اللغة الأم)، الإنجليزية (جيد جدًا)" : "English (Fluent), Arabic (Native)",
      hint: isRTL ? "اذكر اللغات مع مستوى الإتقان." : "Mention languages with proficiency level.",
      icon: Languages,
    },
  ];

  const completedCount = useMemo(() => {
    return Object.values(formData).filter((value) => value.trim().length > 0).length;
  }, [formData]);

  const progressPercentage = Math.round((completedCount / sections.length) * 100);

  const handleChange = (id: string, value: string) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (id === "experience") {
      setExperienceRoles(parseExperienceIntoBullets(value));
    }
  };

  const handleImprove = async (sectionId: string) => {
    const text = formData[sectionId as keyof typeof formData];
    if (!text.trim()) return;

    // Save original for restore
    setOriginals(prev => ({ ...prev, [sectionId]: text }));
    setImprovingSection(sectionId);

    try {
      const { data, error } = await supabase.functions.invoke("improve-section", {
        body: { text, sectionType: sectionId, language },
      });

      if (error) throw error;

      if (data?.improved_text) {
        handleChange(sectionId, data.improved_text);
        toast.success(isRTL ? "تم تحسين القسم بالذكاء الاصطناعي ✨" : "Section improved with AI ✨");
      }
    } catch (err: any) {
      toast.error(err.message || t.common.error);
    } finally {
      setImprovingSection(null);
    }
  };

  const handleRestore = (sectionId: string) => {
    if (originals[sectionId]) {
      handleChange(sectionId, originals[sectionId]);
      setOriginals(prev => {
        const next = { ...prev };
        delete next[sectionId];
        return next;
      });
      toast.success(isRTL ? "تم استعادة النص الأصلي" : "Original text restored");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const pointResult = await deductPoints(user.id, "builder", "Resume Builder save");
      if (!pointResult.success) {
        toast.error(isRTL ? "رصيدك لا يكفي. يرجى شراء نقاط إضافية." : "Insufficient points. Please buy more points.");
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("generated_resumes").insert({
        user_id: user.id,
        title: formData.name || formData.title || (isRTL ? "سيرة ذاتية جديدة" : "Untitled Resume"),
        content: formData,
        language,
      });

      if (error) throw error;
      toast.success(t.builder.saved);
    } catch (err: any) {
      toast.error(err.message || t.common.error);
    } finally {
      setSaving(false);
    }
  };

  const [improvingAll, setImprovingAll] = useState(false);

  const handleImproveAll = async () => {
    const improvableSections = sections.filter((s) => s.type === "textarea" && formData[s.id as keyof typeof formData]?.trim());
    if (improvableSections.length === 0) {
      toast.error(isRTL ? "لا توجد أقسام لتحسينها" : "No sections to improve");
      return;
    }
    setImprovingAll(true);
    let improved = 0;
    for (const section of improvableSections) {
      try {
        const text = formData[section.id as keyof typeof formData];
        setOriginals(prev => ({ ...prev, [section.id]: text }));
        setImprovingSection(section.id);
        const { data, error } = await supabase.functions.invoke("improve-section", {
          body: { text, sectionType: section.id, language },
        });
        if (!error && data?.improved_text) {
          handleChange(section.id, data.improved_text);
          improved++;
        }
      } catch { /* continue */ }
      setImprovingSection(null);
    }
    setImprovingAll(false);
    toast.success(isRTL ? `تم تحسين ${improved} من ${improvableSections.length} أقسام ✨` : `Improved ${improved} of ${improvableSections.length} sections ✨`);
  };

  const handleExportPDF = () => {
    const labels: Record<string, string> = isRTL
      ? { name: "الاسم", title: "المسمى", summary: "الملخص المهني", experience: "الخبرة العملية", skills: "المهارات", education: "التعليم", certifications: "الشهادات", languages: "اللغات" }
      : { name: "Full Name", title: "Job Title", summary: "Professional Summary", experience: "Work Experience", skills: "Skills", education: "Education", certifications: "Certifications", languages: "Languages" };
    
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sectionOrder = ["summary", "experience", "skills", "education", "certifications", "languages"];
    
    let html = `<!DOCTYPE html><html dir="${isRTL ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(formData.name || "Resume")}</title>
<style>@page{size:A4;margin:20mm 18mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1e293b;line-height:1.6;font-size:11pt}.name{font-size:24pt;font-weight:700;color:#0f172a;border-bottom:2px solid #3b82f6;padding-bottom:6px;margin-bottom:4px}.title{font-size:13pt;color:#475569;font-style:italic;margin-bottom:20px}.sh{font-size:11pt;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #dbeafe;padding-bottom:3px;margin-top:16px;margin-bottom:8px}.c{font-size:10.5pt;white-space:pre-wrap;margin-bottom:4px}</style></head><body>`;
    
    if (formData.name) html += `<div class="name">${esc(formData.name)}</div>`;
    if (formData.title) html += `<div class="title">${esc(formData.title)}</div>`;
    
    for (const key of sectionOrder) {
      const value = formData[key as keyof typeof formData]?.trim();
      if (!value) continue;
      html += `<div class="sh">${esc(labels[key] || key)}</div>`;
      for (const line of value.split("\n").filter(Boolean)) {
        const isBullet = /^[•\-▪]/.test(line.trim());
        const text = line.trim().replace(/^[•\-▪]\s*/, "");
        html += `<div class="c">${isBullet ? "• " : ""}${esc(text)}</div>`;
      }
    }
    html += `</body></html>`;
    
    const w = window.open("", "_blank");
    if (!w) { toast.error(isRTL ? "تعذّر فتح نافذة الطباعة" : "Could not open print window"); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); setTimeout(() => w.close(), 1000); }, 300);
    toast.success(isRTL ? "جارٍ تصدير PDF ✓" : "Exporting PDF ✓");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard" aria-label="Back">
                <ArrowLeft size={18} />
              </Link>
            </Button>
            <Link to="/dashboard" className="font-display text-lg font-bold text-foreground">
              TALEN<span className="text-primary">TRY</span>
            </Link>
            <span className="text-border/60 hidden sm:inline">/</span>
            <div className="hidden sm:block">
              <p className="text-sm font-display font-semibold text-foreground">{t.builder.title}</p>
            </div>
           </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImproveAll}
            disabled={improvingAll || !!improvingSection}
            className="gap-2"
          >
            {improvingAll ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isRTL ? "تحسين الكل" : "Improve All"}
          </Button>
        </div>
      </header>

      <main className="container max-w-5xl py-8 md:py-10">
        <section className="mb-8 rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles size={14} />
                <span>{isRTL ? "منشئ السيرة الذاتية الذكي" : "AI Resume Builder"}</span>
              </div>

              <h2 className="mb-3 font-display text-2xl md:text-3xl font-bold text-foreground">
                {isRTL
                  ? "اكتب سيرتك الذاتية بسهولة، ثم دع الذكاء الاصطناعي يحوّلها إلى نسخة أقوى"
                  : "Write your resume easily, then let AI turn it into a stronger version"}
              </h2>

              <p className="text-sm md:text-base leading-7 text-muted-foreground font-body max-w-2xl">
                {isRTL
                  ? "عبّئ الأقسام الأساسية، حسّن أي جزء أو نقطة بضغطة واحدة، ثم احفظ النسخة النهائية."
                  : "Fill in the core sections, improve any part or bullet with one click, then save the final version."}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background/70 p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {isRTL ? "تقدم الإكمال" : "Completion Progress"}
                </span>
                <span className="text-sm font-bold text-primary">{progressPercentage}%</span>
              </div>

              <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              <p className="text-sm text-muted-foreground font-body">
                {isRTL
                  ? `أكملت ${completedCount} من ${sections.length} أقسام`
                  : `You completed ${completedCount} out of ${sections.length} sections`}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          {sections.map((section) => {
            const Icon = section.icon;
            const value = formData[section.id as keyof typeof formData];
            const isImproving = improvingSection === section.id;
            const hasOriginal = !!originals[section.id];

            return (
              <div
                key={section.id}
                className="rounded-3xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md md:p-6"
              >
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon size={20} />
                    </div>

                    <div>
                      <label className="font-display text-base font-semibold text-foreground">{section.label}</label>
                      <p className="mt-1 max-w-2xl text-xs md:text-sm leading-6 text-muted-foreground font-body">
                        {section.hint}
                      </p>
                    </div>
                  </div>

                  {(section.type === "textarea") && (
                    <div className="flex items-center gap-2">
                      {hasOriginal && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground"
                          onClick={() => handleRestore(section.id)}
                        >
                          <RotateCcw size={14} />
                          <span>{isRTL ? "استعادة" : "Restore"}</span>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={isImproving || !value.trim()}
                        onClick={() => handleImprove(section.id)}
                      >
                        {isImproving ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>{t.builder.improving}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>{t.builder.improveWithAI}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-background/70 p-2 md:p-3">
                  {section.type === "input" ? (
                    <Input
                      placeholder={section.placeholder}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                      value={value}
                      onChange={(e) => handleChange(section.id, e.target.value)}
                    />
                  ) : section.type === "experience" ? (
                    <ExperienceEditor
                      roles={experienceRoles}
                      onChange={handleExperienceRolesChange}
                      isRTL={isRTL}
                      language={language}
                    />
                  ) : (
                    <Textarea
                      placeholder={section.placeholder}
                      rows={5}
                      className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                      value={value}
                      onChange={(e) => handleChange(section.id, e.target.value)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                {isRTL ? "احفظ وصدّر" : "Save & Export"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground font-body">
                {isRTL
                  ? "احفظ السيرة داخل حسابك أو صدّرها كملف احترافي."
                  : "Save to your account or export as a professional file."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={handleExportPDF}
                disabled={completedCount === 0}
              >
                <FileDown size={18} className="mr-2" />
                {isRTL ? "تصدير PDF" : "Export PDF"}
              </Button>

              <Button
                variant="default"
                size="lg"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    {t.common.loading}
                  </>
                ) : (
                  <>
                    <FileText size={18} className="mr-2" />
                    {t.builder.save}
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Builder;


