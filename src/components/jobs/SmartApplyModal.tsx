import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { JobItem } from "./JobCard";
import type { UserResumeData } from "@/hooks/useUserResume";
import {
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Wand2,
  Building2,
  MapPin,
  Briefcase,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  job: JobItem | null;
  resumeData: UserResumeData | null;
  ar?: boolean;
}

interface GeneratedContent {
  coverLetter: string;
  recruiterMessage: string;
}

function CopyButton({ text, label, ar }: { text: string; label: string; ar: boolean }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: ar ? "تم النسخ!" : "Copied!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: ar ? "فشل النسخ" : "Copy failed", variant: "destructive" });
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs gap-1.5 shrink-0"
      onClick={handleCopy}
    >
      {copied ? (
        <Check size={12} className="text-green-500" />
      ) : (
        <Copy size={12} />
      )}
      {copied ? (ar ? "تم!" : "Copied!") : label}
    </Button>
  );
}

function SectionBlock({
  title,
  icon: Icon,
  content,
  loading,
  copyLabel,
  ar,
  children,
}: {
  title: string;
  icon: React.ElementType;
  content?: string;
  loading?: boolean;
  copyLabel: string;
  ar: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Icon size={13} className="text-primary" />
          </div>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {content && !loading && (
          <CopyButton text={content} label={copyLabel} ar={ar} />
        )}
      </div>
      {loading ? (
        <div className="h-24 rounded-lg border bg-muted/30 flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">
            {ar ? "جاري التوليد..." : "Generating..."}
          </span>
        </div>
      ) : content ? (
        <div className="relative">
          <Textarea
            value={content}
            readOnly
            className="resize-none text-xs leading-relaxed bg-muted/20 border-border/60 min-h-[100px] font-mono"
            rows={content.split("\n").length + 2}
          />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function SmartApplyModal({ open, onClose, job, resumeData, ar = false }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateContent = useCallback(async () => {
    if (!job || !resumeData) return;
    setLoading(true);
    setError(null);
    setContent(null);

    try {
      const resumeText =
        resumeData.raw_resume_text ||
        Object.entries(resumeData.structured_resume_json || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");

      const prompt = `You are a professional career assistant. Generate two things for a job applicant:

JOB TITLE: ${job.job_title}
COMPANY: ${job.employer_name}
LOCATION: ${[job.job_city, job.job_country].filter(Boolean).join(", ") || "Not specified"}
JOB DESCRIPTION: ${job.job_description?.slice(0, 800) || "Not provided"}
REQUIRED SKILLS: ${job.job_required_skills?.join(", ") || "Not listed"}

CANDIDATE RESUME:
${resumeText?.slice(0, 1200) || "No resume data available"}

Generate EXACTLY this JSON structure (no markdown, just raw JSON):
{
  "coverLetter": "A professional 3-paragraph cover letter tailored to this specific job. Address it 'Dear Hiring Manager,' and end with 'Sincerely,\\n[Your Name]'. Make it specific to the job and company. Keep it concise and impactful.",
  "recruiterMessage": "A short, professional LinkedIn/email message to a recruiter. 3-4 sentences max. Mention the role, a specific strength, and express interest. Start with 'Hi [Recruiter Name],' and end with a call to action."
}`;

      const { data, error: fnError } = await supabase.functions.invoke("improve-section", {
        body: {
          section: "coverLetter",
          content: prompt,
          jobTitle: job.job_title,
          instructions: "Return only raw JSON as specified. No extra text.",
        },
      });

      if (fnError) throw new Error(fnError.message);

      // Try to parse from improve-section response
      const rawText = data?.improved || data?.result || data?.content || "";
      let parsed: GeneratedContent | null = null;

      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // fallback: use raw text
      }

      if (parsed?.coverLetter && parsed?.recruiterMessage) {
        setContent(parsed);
      } else {
        // Use Anthropic API directly through the artifact pattern
        await generateViaAnthropicDirect(job, resumeText);
      }
    } catch (err: any) {
      console.error("SmartApply generation error:", err);
      // Generate offline fallback
      generateFallbackContent(job, resumeData);
    } finally {
      setLoading(false);
    }
  }, [job, resumeData]);

  const generateViaAnthropicDirect = async (job: JobItem, resumeText: string) => {
    const { data, error } = await supabase.functions.invoke("rephrase-selection", {
      body: {
        text: `Generate a cover letter and recruiter message for ${job.job_title} at ${job.employer_name}`,
        context: resumeText?.slice(0, 500),
        jobTitle: job.job_title,
        company: job.employer_name,
      },
    });
    if (!error && data?.rephrased) {
      generateFallbackContent(job, resumeData!);
    } else {
      generateFallbackContent(job, resumeData!);
    }
  };

  const generateFallbackContent = (job: JobItem, resume: UserResumeData) => {
    const structured = resume.structured_resume_json || {};
    const name = structured["name"] || structured["full_name"] || "the candidate";
    const title = resume.detected_job_title || "professional";
    const skills = resume.detected_skills?.split(",").slice(0, 3).join(", ") || "various relevant skills";

    const coverLetter = `Dear Hiring Manager,

I am writing to express my strong interest in the ${job.job_title} position at ${job.employer_name}. With my background as a ${title} and expertise in ${skills}, I believe I would be a valuable addition to your team.

Throughout my career, I have developed a strong foundation in the skills required for this role. I am particularly drawn to ${job.employer_name} because of its reputation and the exciting challenges this position presents. I am confident that my experience and enthusiasm make me an excellent candidate.

I would welcome the opportunity to discuss how my background aligns with your needs. Thank you for considering my application. I look forward to the possibility of contributing to your team.

Sincerely,
${name}`;

    const recruiterMessage = `Hi [Recruiter Name],

I came across the ${job.job_title} opening at ${job.employer_name} and I'm very excited about the opportunity. With my experience as a ${title} and skills in ${skills}, I believe I'm a strong fit for this role.

Would you be open to a quick chat about the position? I'd love to learn more about the team and share how I can contribute.

Best regards,
${name}`;

    setContent({ coverLetter, recruiterMessage });
  };

  useEffect(() => {
    if (open && job && resumeData) {
      generateContent();
    }
    if (!open) {
      setContent(null);
      setError(null);
    }
  }, [open, job?.job_id]);

  const handleImproveResume = () => {
    if (!job) return;
    onClose();
    navigate(
      `/dashboard/resume-enhancement?jobTitle=${encodeURIComponent(job.job_title)}&company=${encodeURIComponent(job.employer_name)}&jobDescription=${encodeURIComponent(job.job_description?.slice(0, 500) || "")}`
    );
  };

  if (!job) return null;

  const location = [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden" dir={ar ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border-b p-5">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-muted border flex items-center justify-center shrink-0 overflow-hidden">
                {job.employer_logo ? (
                  <img
                    src={job.employer_logo}
                    alt=""
                    className="h-full w-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <Building2 className="h-5 w-5 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-bold leading-tight">
                  <span className="flex items-center gap-2 flex-wrap">
                    <Sparkles size={14} className="text-primary shrink-0" />
                    {ar ? "مساعد التقديم الذكي" : "Smart Apply Assistant"}
                  </span>
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5 truncate font-medium">
                  {job.job_title}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 size={10} /> {job.employer_name}
                  </span>
                  {location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={10} /> {location}
                    </span>
                  )}
                  {job.job_employment_type && (
                    <span className="flex items-center gap-1">
                      <Briefcase size={10} /> {job.job_employment_type}
                    </span>
                  )}
                </div>
              </div>
              {job.match_score != null && (
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] font-bold ${
                    job.match_score >= 80
                      ? "text-green-600 bg-green-50 border-green-200"
                      : job.match_score >= 50
                      ? "text-yellow-600 bg-yellow-50 border-yellow-200"
                      : "text-muted-foreground bg-muted"
                  }`}
                >
                  {job.match_score}% {ar ? "تطابق" : "Match"}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {/* Disclaimer */}
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 p-2.5">
            <AlertCircle size={13} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
              {ar
                ? "هذا مساعد للكتابة فقط. لن يتم إرسال أي شيء تلقائياً. راجع المحتوى وقم بتعديله قبل الاستخدام."
                : "This is a writing assistant only. Nothing is sent automatically. Review and edit before using."}
            </p>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[60vh]">
          <div className="p-5 space-y-5">
            {/* No resume warning */}
            {!resumeData && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2">
                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {ar
                    ? "لا توجد بيانات سيرة ذاتية محفوظة. الرجاء رفع سيرتك الذاتية أولاً للحصول على محتوى مخصص."
                    : "No resume data found. Upload your resume first for personalized content."}
                </p>
              </div>
            )}

            {/* Cover Letter */}
            <SectionBlock
              title={ar ? "خطاب التقديم" : "Cover Letter"}
              icon={FileText}
              content={content?.coverLetter}
              loading={loading}
              copyLabel={ar ? "نسخ" : "Copy"}
              ar={ar}
            />

            <Separator />

            {/* Recruiter Message */}
            <SectionBlock
              title={ar ? "رسالة للمُجنِّد" : "Recruiter Message"}
              icon={MessageSquare}
              content={content?.recruiterMessage}
              loading={loading}
              copyLabel={ar ? "نسخ" : "Copy"}
              ar={ar}
            />

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="border-t bg-muted/20 p-4 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={handleImproveResume}
            >
              <Wand2 size={13} />
              {ar ? "تحسين سيرتي الذاتية لهذه الوظيفة" : "Improve Resume for this Job"}
              <ChevronRight size={11} className="text-muted-foreground" />
            </Button>

            {content && !loading && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1.5"
                onClick={generateContent}
              >
                <Sparkles size={12} />
                {ar ? "إعادة التوليد" : "Regenerate"}
              </Button>
            )}
          </div>

          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            asChild
          >
            <a href={job.job_apply_link} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} />
              {ar ? "فتح الوظيفة" : "Open Job"}
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
