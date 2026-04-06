/**
 * TALENTRY — NextStepCard.tsx
 *
 * Universal "what to do next" guidance card.
 * Renders a contextual action card based on candidate stage and data completeness.
 *
 * This is the core NO DEAD ENDS enforcement component.
 * Drop it on any recruiter page to eliminate dead ends.
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Upload,
  Zap,
  ArrowRight,
  Send,
  CheckCircle2,
  Target,
  Sparkles,
  MessageSquareText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export type CandidateStage =
  | "new"
  | "under_review"
  | "shortlisted"
  | "interview_scheduled"
  | "ai_interview_sent"
  | "ai_interview_completed"
  | "live_interview_scheduled"
  | "rejected"
  | "hired";

interface NextStepCardProps {
  candidateId: string;
  candidateName: string;
  candidateEmail?: string | null;
  stage: CandidateStage | string;
  hasExtractedText: boolean;
  hasAiReport: boolean;
  hasMatchedJobs: boolean;
  hasInterviewSession?: boolean;
  interviewSessionId?: string | null;
  ar?: boolean;
  onShortlist?: () => void;
  onStartAnalysis?: () => void;
  className?: string;
}

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  primary: { label: string; action: () => void };
  secondary?: { label: string; action: () => void };
  badge?: string;
  badgeColor?: string;
}

export function NextStepCard({
  candidateId,
  candidateName,
  candidateEmail,
  stage,
  hasExtractedText,
  hasAiReport,
  hasMatchedJobs,
  hasInterviewSession,
  interviewSessionId,
  ar = false,
  onShortlist,
  onStartAnalysis,
  className = "",
}: NextStepCardProps) {
  const navigate = useNavigate();

  // ── Determine the next step based on journey state ─────────────────────────
  const getStep = (): Step | null => {
    // Stage: hired or rejected → no next step
    if (stage === "hired" || stage === "rejected") return null;

    // Stage: ai_interview_completed → decide
    if (stage === "ai_interview_completed") {
      return {
        icon: <CheckCircle2 size={18} className="text-violet-600" />,
        title: ar ? "المقابلة مكتملة — اتخذ قرارك" : "Interview Complete — Make Your Decision",
        description: ar
          ? "راجع نتائج المقابلة وحدد مصير المرشح"
          : "Review interview results and determine the outcome.",
        badge: ar ? "جاهز للقرار" : "Ready to Decide",
        badgeColor: "bg-violet-100 text-violet-700",
        primary: {
          label: ar ? "عرض نتائج المقابلة" : "View Interview Results",
          action: () =>
            interviewSessionId
              ? navigate(`/recruiter/interview/${interviewSessionId}/results`)
              : navigate(`/recruiter/candidates/${candidateId}`),
        },
        secondary: {
          label: ar ? "إجراء مقابلة جديدة" : "Run Another Interview",
          action: () =>
            navigate(`/recruiter/questions?candidate=${candidateId}&name=${encodeURIComponent(candidateName)}`),
        },
      };
    }

    // Stage: ai_interview_sent → waiting
    if (stage === "ai_interview_sent") {
      return {
        icon: <Send size={18} className="text-indigo-600" />,
        title: ar ? "تم إرسال رابط المقابلة" : "Interview Link Sent",
        description: ar
          ? "في انتظار إكمال المرشح للمقابلة. يمكنك إجراء مقابلة داخلية الآن."
          : "Waiting for the candidate to complete the interview. You can run an internal interview now.",
        badge: ar ? "بانتظار المرشح" : "Awaiting Candidate",
        badgeColor: "bg-indigo-100 text-indigo-700",
        primary: {
          label: ar ? "إجراء مقابلة داخلية" : "Run Internal Interview",
          action: () =>
            navigate(`/recruiter/questions?candidate=${candidateId}&name=${encodeURIComponent(candidateName)}`),
        },
      };
    }

    // Stage: shortlisted → interview
    if (stage === "shortlisted") {
      if (!hasInterviewSession) {
        return {
          icon: <Brain size={18} className="text-primary" />,
          title: ar ? "المرشح في القائمة المختصرة — ابدأ المقابلة" : "Candidate Shortlisted — Start Interview",
          description: ar
            ? "الخطوة التالية: إجراء مقابلة AI أو إرسال رابط المقابلة للمرشح"
            : "Next step: run an AI interview or send the candidate an interview link.",
          badge: ar ? "مختصر" : "Shortlisted",
          badgeColor: "bg-green-100 text-green-700",
          primary: {
            label: ar ? "ابدأ مقابلة AI الآن" : "Start AI Interview",
            action: () =>
              navigate(`/recruiter/questions?candidate=${candidateId}&name=${encodeURIComponent(candidateName)}`),
          },
          secondary: candidateEmail
            ? {
                label: ar ? "أرسل رابط المقابلة" : "Send Interview Link",
                action: () =>
                  navigate(`/recruiter/questions?candidate=${candidateId}&name=${encodeURIComponent(candidateName)}`),
              }
            : undefined,
        };
      }
      return null;
    }

    // No AI report yet → generate it
    if (!hasAiReport && hasExtractedText) {
      return {
        icon: <Zap size={18} className="text-amber-500" />,
        title: ar ? "جاهز للتحليل" : "Ready for Analysis",
        description: ar
          ? "تم استخراج السيرة الذاتية. قم بتشغيل تحليل AI للحصول على تقرير كامل."
          : "CV text extracted. Run AI analysis to get a full candidate report.",
        badge: ar ? "بانتظار التحليل" : "Awaiting Analysis",
        badgeColor: "bg-amber-100 text-amber-700",
        primary: {
          label: ar ? "تشغيل تحليل AI" : "Run AI Analysis",
          action: () => onStartAnalysis?.(),
        },
        secondary: {
          label: ar ? "عرض الملف الكامل" : "View Full Profile",
          action: () => navigate(`/recruiter/candidates/${candidateId}`),
        },
      };
    }

    // Has AI report, not yet shortlisted → shortlist or match to jobs
    if (hasAiReport && !["shortlisted", "ai_interview_sent", "ai_interview_completed"].includes(stage)) {
      return {
        icon: <Target size={18} className="text-primary" />,
        title: ar ? "التحليل جاهز — اتخذ قرارك" : "Analysis Ready — Take Action",
        description: ar
          ? "راجع التقرير ثم قرر: اختر المرشح أو طابقه بوظيفة أو ابدأ مقابلة."
          : "Review the AI report, then shortlist, match to a job, or start an interview.",
        primary: {
          label: ar ? "اختيار المرشح" : "Shortlist Candidate",
          action: () => onShortlist?.(),
        },
        secondary: {
          label: ar ? "مطابقة بوظيفة" : "Match to Job",
          action: () => navigate(`/recruiter/candidates/${candidateId}`),
        },
      };
    }

    // No extracted text → upload needed
    if (!hasExtractedText) {
      return {
        icon: <Upload size={18} className="text-muted-foreground" />,
        title: ar ? "لا توجد سيرة ذاتية محملة" : "No CV Uploaded",
        description: ar
          ? "ارفع سيرة ذاتية لهذا المرشح لتفعيل التحليل والمقابلات."
          : "Upload a CV for this candidate to enable AI analysis and interviews.",
        primary: {
          label: ar ? "رفع سيرة ذاتية" : "Upload CV",
          action: () => navigate("/recruiter/candidates?action=upload"),
        },
      };
    }

    // Has jobs matched → suggest interview
    if (hasMatchedJobs && !hasInterviewSession) {
      return {
        icon: <Sparkles size={18} className="text-primary" />,
        title: ar ? "توجد وظائف مطابقة — ابدأ المقابلة" : "Jobs Matched — Start the Interview",
        description: ar
          ? "تم مطابقة المرشح بوظائف. ابدأ مقابلة AI الآن."
          : "Candidate has been matched to jobs. Ready to interview.",
        primary: {
          label: ar ? "ابدأ مقابلة AI" : "Start AI Interview",
          action: () =>
            navigate(`/recruiter/questions?candidate=${candidateId}&name=${encodeURIComponent(candidateName)}`),
        },
      };
    }

    return null;
  };

  const step = getStep();
  if (!step) return null;

  return (
    <Card
      className={`p-4 border-2 border-primary/15 bg-primary/[0.03] relative overflow-hidden ${className}`}
    >
      {/* Subtle gradient accent */}
      <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l-lg" />

      <div className="pl-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              {step.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                {step.badge && (
                  <Badge className={`text-[10px] px-2 py-0.5 ${step.badgeColor || "bg-muted text-muted-foreground"}`}>
                    {step.badge}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {step.secondary && (
              <Button size="sm" variant="outline" onClick={step.secondary.action} className="text-xs">
                {step.secondary.label}
              </Button>
            )}
            <Button size="sm" onClick={step.primary.action} className="text-xs">
              {step.primary.label}
              <ArrowRight size={12} className="ml-1.5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── CandidateStatusBadge ─────────────────────────────────────────────────────
// Consistently rendered status badge across all pages

export function CandidateStatusBadge({ stage }: { stage: string }) {
  const config: Record<string, { color: string; label: string }> = {
    new:                    { color: "bg-slate-100 text-slate-700",   label: "New" },
    under_review:           { color: "bg-yellow-100 text-yellow-700", label: "In Review" },
    shortlisted:            { color: "bg-green-100 text-green-700",   label: "Shortlisted" },
    interview_scheduled:    { color: "bg-purple-100 text-purple-700", label: "Interview Scheduled" },
    ai_interview_sent:      { color: "bg-indigo-100 text-indigo-700", label: "AI Interview Sent" },
    ai_interview_completed: { color: "bg-violet-100 text-violet-700", label: "AI Interview Done" },
    live_interview_scheduled:{ color: "bg-orange-100 text-orange-700",label: "Live Scheduled" },
    rejected:               { color: "bg-red-100 text-red-700",       label: "Rejected" },
    hired:                  { color: "bg-emerald-100 text-emerald-700",label: "Hired ✓" },
  };
  const cfg = config[stage] || { color: "bg-muted text-muted-foreground", label: stage.replace(/_/g, " ") };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ─── JourneyProgressBar ───────────────────────────────────────────────────────
// Visual pipeline progress indicator

const STAGES_ORDER = [
  "new", "under_review", "shortlisted",
  "ai_interview_sent", "ai_interview_completed", "hired",
];

export function JourneyProgressBar({ stage, ar = false }: { stage: string; ar?: boolean }) {
  const labels = ar
    ? ["جديد", "مراجعة", "مختصر", "مقابلة أُرسلت", "مقابلة مكتملة", "تم التعيين"]
    : ["New", "Review", "Shortlisted", "Interview Sent", "Interview Done", "Hired"];

  const currentIdx = STAGES_ORDER.indexOf(stage);

  return (
    <div className="flex items-center gap-1">
      {STAGES_ORDER.map((s, i) => {
        const isCompleted = currentIdx > i;
        const isCurrent = currentIdx === i;
        const isRejected = stage === "rejected";
        return (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                isRejected && isCurrent ? "bg-red-400 w-4" :
                isCompleted ? "bg-primary w-4" :
                isCurrent ? "bg-primary/60 w-4" :
                "bg-muted w-2"
              }`}
              title={labels[i]}
            />
          </div>
        );
      })}
    </div>
  );
}
