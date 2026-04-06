import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StructuredResume } from "@/lib/resume-utils";
import { parseContactString } from "./EditableResumeHeader";
import { sanitizeJobTitle, sanitizeName } from "@/lib/resume-utils";

interface ResumeConfirmationStepProps {
  structured: StructuredResume;
  onConfirm: (updated: StructuredResume) => void;
  onBack: () => void;
  isRTL?: boolean;
  t: (en: string, ar: string) => string;
}

const ResumeConfirmationStep = ({ structured, onConfirm, onBack, isRTL, t }: ResumeConfirmationStepProps) => {
  const parsed = parseContactString(structured.contact);
  const safeName = sanitizeName(structured.name);
  const safeJobTitle = sanitizeJobTitle(structured.job_title);

  const fields = [
    { icon: User, label: t("Full Name", "الاسم الكامل"), value: safeName, key: "name" },
    { icon: Briefcase, label: t("Job Title", "المسمى الوظيفي"), value: safeJobTitle, key: "job_title" },
    { icon: Mail, label: t("Email", "البريد"), value: parsed.email, key: "email" },
    { icon: Phone, label: t("Phone", "الهاتف"), value: parsed.phone, key: "phone" },
    { icon: MapPin, label: t("Location", "الموقع"), value: parsed.location, key: "location" },
    { icon: Linkedin, label: "LinkedIn", value: parsed.linkedin, key: "linkedin" },
  ];

  const sectionSummary = [
    { label: t("Professional Summary", "الملخص المهني"), value: structured.summary, key: "summary" },
    { label: t("Work Experience", "الخبرة العملية"), value: structured.experience, key: "experience" },
    { label: t("Skills", "المهارات"), value: structured.skills, key: "skills" },
    { label: t("Education", "التعليم"), value: structured.education, key: "education" },
    { label: t("Certifications", "الشهادات"), value: structured.certifications, key: "certifications" },
    { label: t("Projects", "المشاريع"), value: structured.projects, key: "projects" },
    { label: t("Languages", "اللغات"), value: structured.languages, key: "languages" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
          <Sparkles size={16} />
          {t("Review Extracted Data", "مراجعة البيانات المستخرجة")}
        </div>
        <h2 className="text-2xl font-bold text-foreground font-display">
          {t("Confirm your resume details", "تأكد من بيانات سيرتك الذاتية")}
        </h2>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          {t(
            "We've extracted the following information from your resume. Please review the detected details and fix anything inaccurate before continuing.",
            "تم استخراج المعلومات التالية من سيرتك الذاتية. يرجى مراجعة البيانات المكتشفة وتصحيح أي شيء غير دقيق قبل المتابعة.",
          )}
        </p>
      </div>

      {/* Identity & Contact */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            {t("Identity & Contact", "الهوية وبيانات الاتصال")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => {
              const Icon = f.icon;
              const hasValue = !!f.value?.trim();
              return (
                <div key={f.key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <Icon className={cn("w-4 h-4 shrink-0", hasValue ? "text-primary" : "text-muted-foreground")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        hasValue ? "text-foreground" : "text-muted-foreground italic",
                      )}
                    >
                      {hasValue ? f.value : t("Not detected", "لم يتم الكشف")}
                    </p>
                  </div>
                  {hasValue ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section Detection Summary */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-primary" />
            {t("Detected Sections", "الأقسام المكتشفة")}
          </h3>
          <div className="space-y-2">
            {sectionSummary.map((s) => {
              const hasContent = !!s.value?.trim();
              const preview = hasContent
                ? s.value.split("\n").slice(0, 2).join(", ").substring(0, 80) + (s.value.length > 80 ? "..." : "")
                : "";
              return (
                <div key={s.key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{s.label}</p>
                      {hasContent ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20"
                        >
                          {t("Detected", "تم الكشف")}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                        >
                          {t("Empty", "فارغ")}
                        </Badge>
                      )}
                    </div>
                    {preview && <p className="text-xs text-muted-foreground mt-1 truncate">{preview}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          {t("← Back", "← رجوع")}
        </Button>
        <Button onClick={() => onConfirm(structured)} size="lg" className="gap-2">
          <Edit3 className="w-4 h-4" />
          {t("Open Editor", "افتح المحرر")}
        </Button>
      </div>
    </div>
  );
};

export default ResumeConfirmationStep;
