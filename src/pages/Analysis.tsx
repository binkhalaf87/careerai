import { useState, useEffect, useMemo } from "react";
import { deductPoints, getPointsBalance, SERVICE_COSTS, hasFreeAnalysis, markFreeAnalysisUsed } from "@/lib/points";
import { useCareerFlow } from "@/contexts/CareerFlowContext";
import FlowProgressBar from "@/components/career-flow/FlowProgressBar";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  ArrowLeft,
  Loader2,
  Target,
  Briefcase,
  TrendingUp,
  DollarSign,
  Sparkles,
  ListChecks,
  Eye,
  CheckCircle2,
  Wand2,
  ChevronRight,
  BarChart3,
  Download,
  AlertTriangle,
  MessageSquare,
  Zap,
  ArrowRight,
  Brain,
  Trophy,
  TrendingDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { InsufficientPointsDialog } from "@/components/InsufficientPointsDialog";
import RewriteSummaryCard from "@/components/resume/RewriteSummaryCard";
import RewriteIssuesCard from "@/components/resume/RewriteIssuesCard";
import RewriteReview from "@/components/resume/RewriteReview";
import { useRewriteResume } from "@/hooks/useRewriteResume";
import { toast } from "sonner";
import { getStoredResumeData, useUserResume } from "@/hooks/useUserResume";
import { useAnalysis } from "@/hooks/useAnalysis";
import { analyzeResumeATS, type StructuredResume as AtsStructuredResume } from "@/lib/resume-ats-engine";
import {
  ScoreBar,
  BreakdownCard,
  RecruiterItem,
  QuickImprovement,
  InterviewQuestion,
} from "@/components/analysis/AnalysisCards";

/* ─── Types (unchanged) ─── */
interface SalaryTableRow {
  role: string;
  monthly_range_low: number;
  monthly_range_high: number;
  when_upper_range: string;
  notes: string;
}
interface FullAnalysis {
  target_role: string;
  candidate_name: string;
  ats_score: number;
  section_scores: Record<string, number>;
  executive_summary: {
    candidate_level: string;
    summary_paragraphs: string;
    best_fit_roles: string[];
    top_strengths: string[];
    main_risks: string[];
  };
  ats_breakdown: Record<
    string,
    { score: number; current_state: string; problem: string; recommended_improvement: string }
  >;
  recruiter_analysis: Record<string, { score: number; comment: string }>;
  career_recommendations: {
    top_roles: { role: string; why_it_fits: string }[];
    skills_to_improve: string[];
    thirty_sixty_ninety_day_plan: { thirty_days: string; sixty_days: string; ninety_days: string };
    certifications_recommended: string[];
    linkedin_improvements?: string;
  };
  salary_estimation: {
    salary_table: SalaryTableRow[];
    offer_range_low: number;
    offer_range_high: number;
    negotiation_target: number;
    anchor: number;
    walk_away: number;
  };
  resume_rewrite: { full_resume: string };
  quick_improvements: { priority: string; description: string; action_step: string }[];
  interview_questions: { question: string; suggested_answer_direction: string }[];
}
type AnalysisStage = "uploading" | "extracting" | "analyzing" | "preparing" | "done";

const stageConfig: Record<AnalysisStage, { en: string; ar: string; progress: number }> = {
  uploading: { en: "Uploading your resume...", ar: "جارٍ رفع السيرة الذاتية...", progress: 10 },
  extracting: { en: "Extracting text from document...", ar: "جارٍ استخراج النص من المستند...", progress: 30 },
  analyzing: {
    en: "Running AI analysis (this may take a minute)...",
    ar: "جارٍ التحليل بالذكاء الاصطناعي (قد يستغرق دقيقة)...",
    progress: 55,
  },
  preparing: { en: "Preparing your report...", ar: "جارٍ إعداد التقرير...", progress: 90 },
  done: { en: "Analysis complete!", ar: "اكتمل التحليل!", progress: 100 },
};
const allStages: AnalysisStage[] = ["uploading", "extracting", "analyzing", "preparing", "done"];
const getSupabaseFunctionErrorMessage = (error: unknown, fallback = "Analysis failed") => {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = record.message || record.error || record.msg;
    if (typeof message === "string" && message.trim()) return message.trim();
    try {
      return JSON.stringify(record);
    } catch {}
  }
  return fallback;
};

const EMPTY_ANALYSIS: FullAnalysis = {
  target_role: "",
  candidate_name: "",
  ats_score: 0,
  section_scores: {},
  executive_summary: {
    candidate_level: "",
    summary_paragraphs: "",
    best_fit_roles: [],
    top_strengths: [],
    main_risks: [],
  },
  ats_breakdown: {},
  recruiter_analysis: {},
  career_recommendations: {
    top_roles: [],
    skills_to_improve: [],
    thirty_sixty_ninety_day_plan: { thirty_days: "", sixty_days: "", ninety_days: "" },
    certifications_recommended: [],
    linkedin_improvements: "",
  },
  salary_estimation: {
    salary_table: [],
    offer_range_low: 0,
    offer_range_high: 0,
    negotiation_target: 0,
    anchor: 0,
    walk_away: 0,
  },
  resume_rewrite: { full_resume: "" },
  quick_improvements: [],
  interview_questions: [],
};

/* ─── Pure helper functions (unchanged logic) ─── */
const getFirstFilled = (...values: Array<string | null | undefined>) => {
  for (const v of values) {
    const n = String(v || "").trim();
    if (n) return n;
  }
  return "";
};
const cleanCombinedField = (v?: string | null) =>
  String(v || "")
    .replace(/\r/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
const parseStructuredResumeForAts = (
  storedResume?: { structured_resume_json?: Record<string, string> | null; raw_resume_text?: string | null } | null,
  extractedText?: string,
): AtsStructuredResume => {
  const s = storedResume?.structured_resume_json || {};
  return {
    fullName: getFirstFilled(s.fullName, s.full_name, s.name),
    jobTitle: getFirstFilled(s.jobTitle, s.job_title, s.title),
    contactInfo: getFirstFilled(s.contactInfo, s.contact_info, s.contact),
    professionalSummary: getFirstFilled(s.professionalSummary, s.professional_summary, s.summary, s.profile),
    workExperience: getFirstFilled(s.workExperience, s.work_experience, s.experience, s.employment_history),
    skills: getFirstFilled(s.skills, s.key_skills),
    education: getFirstFilled(s.education),
    certifications: getFirstFilled(s.certifications, s.courses),
    projects: getFirstFilled(s.projects),
    languages: getFirstFilled(s.languages),
  };
};
const candidateLevelFromScore = (score: number, lang: "ar" | "en") => {
  if (score >= 85) return lang === "ar" ? "جاهز للتقديم" : "Application-ready";
  if (score >= 70) return lang === "ar" ? "جيد ويحتاج تحسينات موجهة" : "Solid with targeted improvements";
  if (score >= 55) return lang === "ar" ? "متوسط ويحتاج تطوير" : "Needs structured improvements";
  return lang === "ar" ? "يحتاج إعادة صياغة واضحة" : "Needs major improvement";
};
const buildDeterministicAnalysis = (resume: AtsStructuredResume, language: "ar" | "en"): FullAnalysis => {
  const ats = analyzeResumeATS(resume);
  const sectionScores: Record<string, number> = {
    resume_formatting: ats.breakdown.structure,
    keyword_optimization: ats.breakdown.keywords,
    experience_quality: ats.breakdown.impact,
    career_progression: ats.breakdown.completeness,
    skills_relevance: ats.breakdown.keywords,
    education_strength: ats.breakdown.completeness,
    contact_information_quality: ats.breakdown.structure,
  };
  const mkBreak = (score: number, csAr: string, csEn: string, pAr: string, pEn: string, rAr: string, rEn: string) => ({
    score,
    current_state: language === "ar" ? csAr : csEn,
    problem: language === "ar" ? pAr : pEn,
    recommended_improvement: language === "ar" ? rAr : rEn,
  });
  const atsBreakdown: FullAnalysis["ats_breakdown"] = {
    formatting: mkBreak(
      ats.breakdown.structure,
      "تنسيق السيرة وبناؤها العام",
      "Overall resume structure and formatting",
      "أي ضعف في التنسيق أو التنظيم يضر القراءة السريعة وأنظمة ATS.",
      "Weak layout or organization reduces ATS and recruiter readability.",
      "حافظ على بنية واضحة مع عناوين أقسام وترتيب ثابت.",
      "Keep a clear structure with consistent section headings and ordering.",
    ),
    sections: mkBreak(
      ats.breakdown.completeness,
      "اكتمال الأقسام الأساسية",
      "Completeness of core sections",
      "نقص الأقسام الأساسية يقلل موثوقية السيرة.",
      "Missing core sections lowers credibility and ATS readiness.",
      "أكمل الملخص، الخبرة، المهارات، والتعليم قبل التقديم.",
      "Complete summary, experience, skills, and education before applying.",
    ),
    keywords: mkBreak(
      ats.breakdown.keywords,
      "الكلمات المفتاحية الحالية",
      "Current keyword coverage",
      "ضعف الكلمات المفتاحية يقلل ظهور السيرة في الفرز الآلي.",
      "Low keyword coverage reduces visibility in ATS filtering.",
      "أضف كلمات مرتبطة بالدور بشكل طبيعي.",
      "Add target-role keywords naturally.",
    ),
    experience: mkBreak(
      ats.breakdown.impact,
      "الأثر داخل الخبرة العملية",
      "Impact inside work experience",
      "قلة الأرقام والنتائج تجعل الخبرة تبدو عامة.",
      "Lack of numbers makes experience feel generic.",
      "أضف أرقاماً أو نتائج تشغيلية.",
      "Add measurable results such as ticket volume or SLA performance.",
    ),
    education: mkBreak(
      ats.breakdown.completeness,
      "حضور التعليم والمؤهلات",
      "Education and qualification coverage",
      "غياب المؤهلات يؤثر على الصورة الكاملة للمرشح.",
      "Weak or missing education details hurt profile completeness.",
      "اعرض المؤهل وتاريخ التخرج والشهادات بوضوح.",
      "Present the degree, graduation date, and certifications clearly.",
    ),
    skills: mkBreak(
      ats.breakdown.keywords,
      "قوة قسم المهارات",
      "Strength of skills section",
      "المهارات العامة تقلل التأثير.",
      "Generic skills reduce impact.",
      "قسّم المهارات إلى تقنية وتشغيلية وأدوات.",
      "Group skills into technical, operational, and tools-based categories.",
    ),
    contact_info: mkBreak(
      ats.breakdown.structure,
      "وضوح بيانات التواصل",
      "Contact information clarity",
      "أي خلل في البريد أو الجوال يضعف جاهزية السيرة.",
      "Broken contact fields reduce resume readiness.",
      "تأكد من صحة معلومات التواصل.",
      "Verify contact details and remove malformed formatting.",
    ),
  };
  const topStrengths = [
    ats.breakdown.structure >= 70
      ? language === "ar"
        ? "بنية السيرة واضحة وقابلة للقراءة."
        : "The resume structure is clear and readable."
      : "",
    ats.breakdown.keywords >= 60
      ? language === "ar"
        ? "توجد كلمات مفتاحية مقبولة مرتبطة بالدور."
        : "There is acceptable role-relevant keyword coverage."
      : "",
    ats.breakdown.impact >= 70
      ? language === "ar"
        ? "الخبرة تحتوي على أثر قابل للإبراز."
        : "Work experience includes impact that can be highlighted."
      : "",
  ].filter(Boolean);
  const mainRisks = ats.issues.map((i) => i.title);
  return {
    ...EMPTY_ANALYSIS,
    target_role: resume.jobTitle || "",
    candidate_name: resume.fullName || "",
    ats_score: ats.overallScore,
    section_scores: sectionScores,
    executive_summary: {
      candidate_level: candidateLevelFromScore(ats.overallScore, language),
      summary_paragraphs:
        language === "ar"
          ? `تم إنشاء هذا التقييم عبر محرك TALENTRY الداخلي. الدرجة الحالية ${ats.overallScore}/100.`
          : `This score was generated using the TALENTRY internal ATS engine. Current score: ${ats.overallScore}/100.`,
      best_fit_roles: resume.jobTitle ? [resume.jobTitle] : [],
      top_strengths: topStrengths,
      main_risks: mainRisks,
    },
    ats_breakdown: atsBreakdown,
    quick_improvements: ats.issues.map((issue) => ({
      priority: issue.severity,
      description: issue.title,
      action_step: issue.suggestion,
    })),
  };
};
const mergeWithDeterministicAnalysis = (
  deterministic: FullAnalysis,
  existing?: Partial<FullAnalysis> | null,
): FullAnalysis => ({
  ...deterministic,
  ...existing,
  ats_score: deterministic.ats_score,
  section_scores: deterministic.section_scores,
  ats_breakdown: deterministic.ats_breakdown,
  candidate_name: deterministic.candidate_name || String(existing?.candidate_name || ""),
  target_role: deterministic.target_role || String(existing?.target_role || ""),
  executive_summary: {
    ...deterministic.executive_summary,
    ...(existing?.executive_summary || {}),
    candidate_level: deterministic.executive_summary.candidate_level,
    best_fit_roles:
      (existing?.executive_summary?.best_fit_roles?.length
        ? existing.executive_summary.best_fit_roles
        : deterministic.executive_summary.best_fit_roles) || [],
    top_strengths:
      (existing?.executive_summary?.top_strengths?.length
        ? existing.executive_summary.top_strengths
        : deterministic.executive_summary.top_strengths) || [],
    main_risks:
      (existing?.executive_summary?.main_risks?.length
        ? existing.executive_summary.main_risks
        : deterministic.executive_summary.main_risks) || [],
  },
  quick_improvements: deterministic.quick_improvements.length
    ? deterministic.quick_improvements
    : existing?.quick_improvements || [],
  resume_rewrite: { ...deterministic.resume_rewrite, ...(existing?.resume_rewrite || {}) },
  career_recommendations: {
    ...deterministic.career_recommendations,
    ...(existing?.career_recommendations || {}),
    thirty_sixty_ninety_day_plan: {
      ...deterministic.career_recommendations.thirty_sixty_ninety_day_plan,
      ...(existing?.career_recommendations?.thirty_sixty_ninety_day_plan || {}),
    },
  },
  salary_estimation: { ...deterministic.salary_estimation, ...(existing?.salary_estimation || {}) },
});

/* ─── Score helpers ─── */
const scoreColor = (s: number) => (s >= 80 ? "text-emerald-500" : s >= 60 ? "text-amber-500" : "text-red-500");
const scoreBg = (s: number) => (s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-amber-500" : "bg-red-500");
const scoreRingColor = (s: number) => (s >= 80 ? "rgb(16,185,129)" : s >= 60 ? "rgb(245,158,11)" : "rgb(239,68,68)");

/* ─── Section focus map ─── */
const sectionFocusMap: Record<string, string> = {
  resume_formatting: "contactInfo",
  keyword_optimization: "skills",
  experience_quality: "workExperience",
  career_progression: "workExperience",
  skills_relevance: "skills",
  education_strength: "education",
  contact_information_quality: "contactInfo",
  formatting: "contactInfo",
  sections: "professionalSummary",
  keywords: "skills",
  experience: "workExperience",
  education: "education",
  skills: "skills",
  contact_info: "contactInfo",
};

/* ══════════════════════════════════════════════
   ANALYSIS PAGE
══════════════════════════════════════════════ */
const Analysis = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState<AnalysisStage>("uploading");
  const [result, setResult] = useState<FullAnalysis | null>(null);
  const [lastAnalysisId, setLastAnalysisId] = useState<string | null>(null);
  const [reportLanguage, setReportLanguage] = useState<"ar" | "en">("ar");
  const [autoAnalyzeFailed, setAutoAnalyzeFailed] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "corrections" | "enhanced">("overview");
  const [correctionsDraft, setCorrectionsDraft] = useState({ fullName: "", title: "", contact: "", summary: "" });
  const [showInsufficientPoints, setShowInsufficientPoints] = useState(false);
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { markStep } = useCareerFlow();

  const reviewAnalysisId = searchParams.get("review");
  const resumeId = searchParams.get("id");
  const analysisRunKey = `${resumeId ?? ""}:${reviewAnalysisId ?? ""}`;
  const requestedTab = searchParams.get("tab");
  const { data: storedResumeData } = useUserResume(resumeId);
  const {
    analysis: latestStoredAnalysis,
    loading: loadingStoredAnalysis,
    error: storedAnalysisError,
  } = useAnalysis(resumeId);
  const { rewrite, result: rewriteResult, loading: rewriteLoading, error: rewriteError } = useRewriteResume();

  const hasText = (v?: string | null) => !!String(v || "").trim();
  const hasArray = (v?: unknown[]) => Array.isArray(v) && v.length > 0;
  const hasObject = (v?: Record<string, any> | null) => !!v && typeof v === "object" && Object.keys(v).length > 0;

  /* ── Safe normalization helpers ── */
  const JUNK_VALUES = new Set(["n/a", "na", "null", "undefined", "none", "—", "-", ""]);
  const isJunk = (v: unknown): boolean => {
    if (v === null || v === undefined) return true;
    const s = String(v).trim().toLowerCase();
    return JUNK_VALUES.has(s) || s.length === 0;
  };
  const safeText = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "number") return String(v);
    if (Array.isArray(v))
      return v
        .filter((x) => !isJunk(x))
        .map((x) => safeText(x))
        .join(" ")
        .trim();
    if (typeof v === "object") {
      // Try common text fields
      const obj = v as Record<string, unknown>;
      return safeText(obj.text || obj.content || obj.value || obj.description || "");
    }
    return "";
  };
  const safeList = (v: unknown): string[] => {
    if (!v) return [];
    if (typeof v === "string") {
      return v
        .split(/[\n;]/)
        .map((s) => s.replace(/^[\s•\-*]+/, "").trim())
        .filter((s) => !isJunk(s));
    }
    if (Array.isArray(v)) {
      return v.flatMap((item) => {
        if (typeof item === "string") return isJunk(item) ? [] : [item.trim()];
        if (typeof item === "object" && item !== null) {
          const obj = item as Record<string, unknown>;
          const text = safeText(
            obj.text || obj.content || obj.value || obj.description || obj.title || obj.issue || "",
          );
          return isJunk(text) ? [] : [text];
        }
        return [];
      });
    }
    return [];
  };
  const dedupeList = (items: string[]): string[] => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const normalizeScore = (v: unknown): number => {
    if (typeof v === "number" && !isNaN(v)) return Math.round(Math.min(100, Math.max(0, v)));
    if (typeof v === "string") {
      const n = parseFloat(v);
      if (!isNaN(n)) return Math.round(Math.min(100, Math.max(0, n)));
    }
    return -1; // sentinel for "no valid score"
  };
  const extractSummaryText = (v: unknown): string => {
    if (typeof v === "string") return v.trim();
    if (Array.isArray(v))
      return v
        .filter((s) => !isJunk(s))
        .map(safeText)
        .join(" ")
        .trim();
    if (typeof v === "object" && v !== null) {
      const obj = v as Record<string, unknown>;
      return safeText(obj.text || obj.content || obj.paragraphs || obj.summary || "");
    }
    return "";
  };
  const cleanDisplayText = (v: string): string => {
    return v
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/^[\s•\-*]+/gm, "")
      .trim();
  };

  const buildEnhanceUrl = (focus?: string) => {
    const p = new URLSearchParams();
    if (lastAnalysisId) p.set("analysis", lastAnalysisId);
    if (focus) p.set("focus", focus);
    const q = p.toString();
    return q ? `/enhance?${q}` : "/enhance";
  };

  const reconstructStoredResult = (
    existing: Record<string, unknown>,
    deterministic?: FullAnalysis | null,
  ): FullAnalysis => {
    // Try to find a nested payload in any known key
    const payload = (existing?.full_analysis ||
      existing?.analysis_payload ||
      existing?.result_json ||
      existing?.raw_result ||
      null) as Record<string, any> | null;

    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      // Normalize ats_score — try all possible key names
      const rawScore =
        payload.ats_score ??
        payload.overall_score ??
        payload.score ??
        payload.ats_score_value ??
        existing.overall_score ??
        null;
      const ats_score_norm = normalizeScore(rawScore);
      const ats_score = ats_score_norm >= 0 ? ats_score_norm : 0;

      // Normalize section_scores — validate each value is a number
      const rawSectionScores = payload.section_scores || existing.section_scores || {};
      const section_scores: Record<string, number> = {};
      if (typeof rawSectionScores === "object" && !Array.isArray(rawSectionScores)) {
        for (const [k, v] of Object.entries(rawSectionScores as Record<string, unknown>)) {
          const n = normalizeScore(v);
          if (n >= 0) section_scores[k] = n;
        }
      }

      // Normalize executive_summary
      const rawExec = payload.executive_summary || {};
      const summaryText = extractSummaryText(
        rawExec.summary_paragraphs || rawExec.summary || rawExec.paragraphs || payload.summary || "",
      );
      const best_fit_roles = dedupeList(
        safeList(rawExec.best_fit_roles || payload.best_fit_roles || existing.best_fit_roles || []),
      );
      const top_strengths = dedupeList(
        safeList(rawExec.top_strengths || rawExec.strengths || payload.strengths || existing.strengths || []),
      );
      const main_risks = dedupeList(
        safeList(
          rawExec.main_risks || rawExec.risks || rawExec.weaknesses || payload.weaknesses || existing.weaknesses || [],
        ),
      );

      // Normalize quick_improvements
      const rawImprovements = payload.quick_improvements || payload.improvements || payload.priority_fixes || [];
      const quick_improvements: FullAnalysis["quick_improvements"] = Array.isArray(rawImprovements)
        ? rawImprovements
            .map((item: unknown) => {
              if (typeof item === "string") return { priority: "medium", description: item.trim(), action_step: "" };
              if (typeof item === "object" && item !== null) {
                const obj = item as Record<string, unknown>;
                const description = safeText(obj.description || obj.issue || obj.title || obj.text || obj.fix || "");
                const action_step = safeText(obj.action_step || obj.action || obj.recommendation || obj.how || "");
                const priority = safeText(obj.priority || obj.severity || "medium").toLowerCase();
                return { priority, description, action_step };
              }
              return null;
            })
            .filter((x): x is NonNullable<typeof x> => !!x && !isJunk(x.description))
        : ((existing.suggestions as string[]) || [])
            .map((s: string) => ({
              priority: "medium",
              description: typeof s === "string" ? s.trim() : safeText(s),
              action_step: "",
            }))
            .filter((x) => !isJunk(x.description));

      // Normalize interview_questions
      const rawQuestions = payload.interview_questions || [];
      const interview_questions: FullAnalysis["interview_questions"] = Array.isArray(rawQuestions)
        ? rawQuestions
            .map((q: unknown) => {
              if (typeof q === "string") return { question: q.trim(), suggested_answer_direction: "" };
              if (typeof q === "object" && q !== null) {
                const obj = q as Record<string, unknown>;
                return {
                  question: safeText(obj.question || obj.q || obj.text || ""),
                  suggested_answer_direction: safeText(
                    obj.suggested_answer_direction || obj.answer || obj.direction || obj.hint || "",
                  ),
                };
              }
              return null;
            })
            .filter((q): q is NonNullable<typeof q> => !!q && !isJunk(q.question))
        : [];

      // Normalize ats_breakdown — validate each entry has required shape
      const rawBreakdown = payload.ats_breakdown || {};
      const ats_breakdown: FullAnalysis["ats_breakdown"] = {};
      if (typeof rawBreakdown === "object" && !Array.isArray(rawBreakdown)) {
        for (const [k, v] of Object.entries(rawBreakdown as Record<string, unknown>)) {
          if (typeof v === "object" && v !== null) {
            const entry = v as Record<string, unknown>;
            const score = normalizeScore(entry.score);
            if (score >= 0) {
              ats_breakdown[k] = {
                score,
                current_state: safeText(entry.current_state || entry.status || entry.state || ""),
                problem: safeText(entry.problem || entry.issue || entry.weakness || ""),
                recommended_improvement: safeText(
                  entry.recommended_improvement || entry.recommendation || entry.improvement || "",
                ),
              };
            }
          }
        }
      }

      // Normalize career_recommendations
      const rawCareer = payload.career_recommendations || {};
      const top_roles = Array.isArray(rawCareer.top_roles)
        ? rawCareer.top_roles
            .map((r: unknown) => {
              if (typeof r === "string") return { role: r, why_it_fits: "" };
              if (typeof r === "object" && r !== null) {
                const obj = r as Record<string, unknown>;
                return {
                  role: safeText(obj.role || obj.title || obj.name || ""),
                  why_it_fits: safeText(obj.why_it_fits || obj.reason || obj.why || ""),
                };
              }
              return null;
            })
            .filter((r): r is NonNullable<typeof r> => !!r && !isJunk(r.role))
        : [];

      const hydrated: FullAnalysis = {
        ...EMPTY_ANALYSIS,
        target_role: safeText(payload.target_role || existing.target_role || ""),
        candidate_name: safeText(payload.candidate_name || existing.candidate_name || ""),
        ats_score,
        section_scores: Object.keys(section_scores).length > 0 ? section_scores : EMPTY_ANALYSIS.section_scores,
        executive_summary: {
          candidate_level: safeText(rawExec.candidate_level || ""),
          summary_paragraphs: cleanDisplayText(summaryText),
          best_fit_roles,
          top_strengths,
          main_risks,
        },
        ats_breakdown: Object.keys(ats_breakdown).length > 0 ? ats_breakdown : EMPTY_ANALYSIS.ats_breakdown,
        recruiter_analysis: typeof payload.recruiter_analysis === "object" ? payload.recruiter_analysis || {} : {},
        career_recommendations: {
          ...EMPTY_ANALYSIS.career_recommendations,
          top_roles,
          skills_to_improve: dedupeList(safeList(rawCareer.skills_to_improve || [])),
          certifications_recommended: dedupeList(
            safeList(rawCareer.certifications_recommended || rawCareer.certifications || []),
          ),
          linkedin_improvements: safeText(rawCareer.linkedin_improvements || rawCareer.linkedin || ""),
          thirty_sixty_ninety_day_plan: {
            thirty_days: safeText(rawCareer.thirty_sixty_ninety_day_plan?.thirty_days || ""),
            sixty_days: safeText(rawCareer.thirty_sixty_ninety_day_plan?.sixty_days || ""),
            ninety_days: safeText(rawCareer.thirty_sixty_ninety_day_plan?.ninety_days || ""),
          },
        },
        salary_estimation: { ...EMPTY_ANALYSIS.salary_estimation, ...(payload.salary_estimation || {}) },
        resume_rewrite: { full_resume: safeText(payload.resume_rewrite?.full_resume || "") },
        quick_improvements,
        interview_questions,
      };

      return deterministic ? mergeWithDeterministicAnalysis(deterministic, hydrated) : hydrated;
    }

    // Flat / legacy format — no nested payload object
    const rawScore = existing?.overall_score ?? existing?.ats_score ?? existing?.score ?? null;
    const ats_score = normalizeScore(rawScore);
    const fallback: FullAnalysis = {
      ...EMPTY_ANALYSIS,
      target_role: safeText((existing?.target_role as string) || ""),
      candidate_name: safeText((existing?.candidate_name as string) || ""),
      ats_score: ats_score >= 0 ? ats_score : 0,
      section_scores: (existing?.section_scores as Record<string, number>) || {},
      executive_summary: {
        ...EMPTY_ANALYSIS.executive_summary,
        top_strengths: dedupeList(safeList(existing?.strengths || existing?.top_strengths || [])),
        main_risks: dedupeList(safeList(existing?.weaknesses || existing?.main_risks || existing?.risks || [])),
        best_fit_roles: dedupeList(safeList(existing?.best_fit_roles || [])),
        summary_paragraphs: safeText(existing?.summary || existing?.executive_summary || ""),
        candidate_level: safeText(existing?.candidate_level || ""),
      },
      quick_improvements: dedupeList(safeList(existing?.suggestions || [])).map((s: string) => ({
        priority: "medium",
        description: s,
        action_step: "",
      })),
    };
    return deterministic ? mergeWithDeterministicAnalysis(deterministic, fallback) : fallback;
  };

  useEffect(() => {
    setAutoAnalyzeFailed(false);
    setSelectedResumeId(resumeId || null);
  }, [analysisRunKey, resumeId]);

  /* ── Main auto-analyze effect (logic unchanged) ── */
  useEffect(() => {
    if ((!resumeId && !reviewAnalysisId) || !user || analyzing || result || autoAnalyzeFailed) return;
    const autoAnalyze = async () => {
      try {
        if (reviewAnalysisId) {
          const { data: selectedAnalysis, error } = await supabase
            .from("analyses")
            .select("*")
            .eq("id", reviewAnalysisId)
            .eq("user_id", user.id)
            .single();
          if (error || !selectedAnalysis) {
            toast.error(language === "ar" ? "لم يتم العثور على التحليل" : "Analysis not found");
            setAutoAnalyzeFailed(true);
            return;
          }
          let deterministicReview: FullAnalysis | null = null;
          const linkedResumeId = String((selectedAnalysis as Record<string, unknown>)?.resume_id || "");
          if (linkedResumeId) {
            const storedResume = await getStoredResumeData(user.id, linkedResumeId);
            deterministicReview = buildDeterministicAnalysis(
              parseStructuredResumeForAts(storedResume, storedResume?.raw_resume_text || ""),
              reportLanguage,
            );
          }
          setLastAnalysisId(selectedAnalysis.id);
          setResult(reconstructStoredResult(selectedAnalysis, deterministicReview));
          markStep("analyze");
          toast.success(language === "ar" ? "تم تحميل التحليل" : "Analysis loaded");
          return;
        }
        if (!resumeId) return;
        let storedResume = await getStoredResumeData(user.id, resumeId);
        const { data: existingAnalysis } = await supabase
          .from("analyses")
          .select("*")
          .eq("resume_id", resumeId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (existingAnalysis && existingAnalysis.length > 0) {
          const existing = existingAnalysis[0];
          const { data: resumeMeta } = await supabase.from("resumes").select("updated_at").eq("id", resumeId).single();
          const resumeUpdated = resumeMeta?.updated_at ? new Date(resumeMeta.updated_at) : null;
          const analysisCreated = new Date(existing.created_at);
          if (!resumeUpdated || resumeUpdated <= analysisCreated) {
            const deterministicCached = buildDeterministicAnalysis(
              parseStructuredResumeForAts(storedResume, storedResume?.raw_resume_text || ""),
              reportLanguage,
            );
            setLastAnalysisId(existing.id);
            setResult(reconstructStoredResult(existing, deterministicCached));
            markStep("analyze");
            toast.success(language === "ar" ? "تم تحميل التحليل السابق" : "Previous analysis loaded");
            return;
          }
        }
        const { data: resume, error: resumeError } = await supabase
          .from("resumes")
          .select("*")
          .eq("id", resumeId)
          .eq("user_id", user.id)
          .single();
        if (resumeError || !resume) {
          toast.error(language === "ar" ? "لم يتم العثور على السيرة الذاتية" : "Resume not found");
          setAutoAnalyzeFailed(true);
          return;
        }
        let extractedText = resume.extracted_text || "";
        if (!extractedText || extractedText.length < 30) {
          if (storedResume?.raw_resume_text && storedResume.raw_resume_text.length >= 30)
            extractedText = storedResume.raw_resume_text;
        }
        if (!extractedText || extractedText.length < 30) {
          setAnalyzing(true);
          setStage("extracting");
          const { data: fileData } = await supabase.storage.from("resumes").download(resume.file_path);
          if (!fileData) {
            toast.error(language === "ar" ? "فشل تحميل الملف" : "Failed to download file");
            setAutoAnalyzeFailed(true);
            return;
          }
          const formData = new FormData();
          formData.append(
            "file",
            new File([fileData], resume.file_name, { type: resume.file_type || "application/pdf" }),
          );
          const { data: extractData, error: extractError } = await supabase.functions.invoke("extract-text", {
            body: formData,
          });
          if (extractError) throw extractError;
          extractedText = extractData.text || "";
          await supabase
            .from("resumes")
            .update({ extracted_text: extractedText, language: extractData.language || "en" })
            .eq("id", resumeId);
          storedResume = await getStoredResumeData(user.id, resumeId);
        }
        if (extractedText.length < 30) {
          toast.error(language === "ar" ? "لم يتم استخراج نص كافٍ" : "Not enough text extracted");
          setAutoAnalyzeFailed(true);
          return;
        }
        const deterministicAnalysis = buildDeterministicAnalysis(
          parseStructuredResumeForAts(storedResume, extractedText),
          reportLanguage,
        );
        const freeAvailable = await hasFreeAnalysis(user.id);
        if (!freeAvailable) {
          const balance = await getPointsBalance(user.id);
          if (balance < SERVICE_COSTS.analysis) {
            toast.error(
              language === "ar"
                ? "رصيدك لا يكفي. يرجى شراء نقاط إضافية."
                : "Insufficient points. Please buy more points.",
            );
            setAutoAnalyzeFailed(true);
            return;
          }
        }
        setAnalyzing(true);
        setStage("analyzing");
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token;
        if (!supabaseUrl || !supabaseKey) throw new Error("Supabase environment variables are missing");
        if (!accessToken)
          throw new Error(
            language === "ar" ? "انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى" : "Session expired. Please sign in again.",
          );
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);
        const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, apikey: supabaseKey },
          body: JSON.stringify({ resumeText: extractedText, language: reportLanguage }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!analyzeResponse.ok) {
          const errText = await analyzeResponse.text();
          let errMessage = errText || "Analysis failed";
          try {
            const parsed = JSON.parse(errText);
            errMessage = getSupabaseFunctionErrorMessage(parsed, errMessage);
          } catch {
            errMessage = getSupabaseFunctionErrorMessage(errText, errMessage);
          }
          throw new Error(analyzeResponse.status === 429 ? "Rate limit exceeded" : errMessage);
        }
        const analysisData = await analyzeResponse.json();
        if (analysisData.error) throw new Error(getSupabaseFunctionErrorMessage(analysisData.error, "Analysis failed"));
        const mergedAnalysis = mergeWithDeterministicAnalysis(deterministicAnalysis, {
          ...analysisData,
          executive_summary: { ...deterministicAnalysis.executive_summary, ...(analysisData.executive_summary || {}) },
          career_recommendations: {
            ...deterministicAnalysis.career_recommendations,
            ...(analysisData.career_recommendations || {}),
            thirty_sixty_ninety_day_plan: {
              ...deterministicAnalysis.career_recommendations.thirty_sixty_ninety_day_plan,
              ...(analysisData.career_recommendations?.thirty_sixty_ninety_day_plan || {}),
            },
          },
          salary_estimation: { ...deterministicAnalysis.salary_estimation, ...(analysisData.salary_estimation || {}) },
          resume_rewrite: { ...deterministicAnalysis.resume_rewrite, ...(analysisData.resume_rewrite || {}) },
        });
        if (freeAvailable) {
          await markFreeAnalysisUsed(user.id);
        } else {
          const pointResult = await deductPoints(user!.id, "analysis", "CV Analysis");
          if (!pointResult.success) {
            toast.error(language === "ar" ? "رصيدك لا يكفي." : "Insufficient points.");
            setAutoAnalyzeFailed(true);
            return;
          }
        }
        setStage("preparing");
        const { data: analysisRow } = await supabase
          .from("analyses")
          .insert({
            user_id: user.id,
            resume_id: resumeId,
            overall_score: mergedAnalysis.ats_score || 0,
            section_scores: mergedAnalysis.section_scores || {},
            strengths: mergedAnalysis.executive_summary?.top_strengths || [],
            weaknesses: mergedAnalysis.executive_summary?.main_risks || [],
            suggestions: mergedAnalysis.quick_improvements?.map((q) => q.description) || [],
            language: reportLanguage,
            full_analysis: mergedAnalysis,
          } as any)
          .select("id")
          .single();
        if (analysisRow) setLastAnalysisId(analysisRow.id);
        setStage("done");
        await new Promise((r) => setTimeout(r, 600));
        setResult(mergedAnalysis);
        markStep("analyze");
        toast.success(t.analysis.analysisComplete);
      } catch (err: any) {
        console.error("Auto-analysis error:", err);
        if (resumeId) {
          const storedResume = await getStoredResumeData(user.id, resumeId);
          setResult(
            buildDeterministicAnalysis(
              parseStructuredResumeForAts(storedResume, storedResume?.raw_resume_text || ""),
              reportLanguage,
            ),
          );
          markStep("analyze");
          toast.success(language === "ar" ? "تم إنشاء تحليل TALENTRY الأساسي" : "Generated TALENTRY core analysis");
        } else {
          toast.error(
            err?.name === "AbortError"
              ? language === "ar"
                ? "انتهت المهلة"
                : "Request timed out"
              : err?.message || t.common.error,
          );
          setAutoAnalyzeFailed(true);
        }
      } finally {
        setAnalyzing(false);
      }
    };
    autoAnalyze();
  }, [user, resumeId, reviewAnalysisId, analyzing, result, language, t, reportLanguage, autoAnalyzeFailed]);

  /* ── Resumes loader ── */
  const [userResumes, setUserResumes] = useState<{ id: string; file_name: string; created_at: string }[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const selectedResume = useMemo(() => {
    if (selectedResumeId) return userResumes.find((resume) => resume.id === selectedResumeId) || null;
    if (resumeId) return userResumes.find((resume) => resume.id === resumeId) || null;
    return null;
  }, [userResumes, selectedResumeId, resumeId]);
  useEffect(() => {
    if (!user || result || reviewAnalysisId) return;
    let isActive = true;
    const loadResumes = async () => {
      setLoadingResumes(true);
      const timeoutId = setTimeout(() => {
        if (isActive) {
          setLoadingResumes(false);
          toast.error(language === "ar" ? "انتهت مهلة تحميل السير الذاتية" : "Resumes loading timed out");
        }
      }, 12000);
      try {
        const { data, error } = await supabase
          .from("resumes")
          .select("id, file_name, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (isActive) setUserResumes(data || []);
      } catch {
        if (isActive) toast.error(language === "ar" ? "تعذر تحميل السير الذاتية" : "Failed to load resumes");
      } finally {
        clearTimeout(timeoutId);
        if (isActive) setLoadingResumes(false);
      }
    };
    loadResumes();
    return () => {
      isActive = false;
    };
  }, [user, result, reviewAnalysisId, language]);

  useEffect(() => {
    if (reviewAnalysisId || loadingResumes || userResumes.length === 0) return;

    if (resumeId) {
      const exists = userResumes.some((resume) => resume.id === resumeId);
      if (exists) {
        setSelectedResumeId((current) => (current === resumeId ? current : resumeId));
        return;
      }
    }

    if (userResumes.length === 1 && !resumeId) {
      const onlyResume = userResumes[0];
      setSelectedResumeId(onlyResume.id);
      navigate(`/analysis?id=${onlyResume.id}`, { replace: true });
    }
  }, [userResumes, loadingResumes, resumeId, reviewAnalysisId, navigate]);

  const handleResumeSelect = (resumeIdToOpen: string) => {
    setSelectedResumeId(resumeIdToOpen);
    setResult(null);
    setLastAnalysisId(null);
    setAutoAnalyzeFailed(false);
    navigate(`/analysis?id=${resumeIdToOpen}`);
  };

  const handleRetrySelectedResume = () => {
    const targetResumeId = selectedResumeId || resumeId || userResumes[0]?.id;
    if (!targetResumeId) return;
    setResult(null);
    setLastAnalysisId(null);
    setAutoAnalyzeFailed(false);
    navigate(`/analysis?id=${targetResumeId}`, { replace: true });
  };

  useEffect(() => {
    if (requestedTab === "overview" || requestedTab === "corrections" || requestedTab === "enhanced") {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  useEffect(() => {
    const structured = storedResumeData?.structured_resume_json || {};
    setCorrectionsDraft({
      fullName: getFirstFilled(structured.fullName, structured.full_name, structured.name),
      title: getFirstFilled(
        structured.jobTitle,
        structured.job_title,
        structured.title,
        storedResumeData?.detected_job_title,
      ),
      contact: cleanCombinedField(getFirstFilled(structured.contactInfo, structured.contact_info, structured.contact)),
      summary: cleanCombinedField(
        getFirstFilled(
          structured.professionalSummary,
          structured.professional_summary,
          structured.summary,
          structured.profile,
        ),
      ),
    });
  }, [storedResumeData]);

  useEffect(() => {
    if (result || reviewAnalysisId || !resumeId || loadingStoredAnalysis || !latestStoredAnalysis) return;
    try {
      const deterministic = buildDeterministicAnalysis(
        parseStructuredResumeForAts(storedResumeData || null, storedResumeData?.raw_resume_text || ""),
        reportLanguage,
      );
      setLastAnalysisId(latestStoredAnalysis.id);
      setResult(reconstructStoredResult(latestStoredAnalysis as unknown as Record<string, unknown>, deterministic));
    } catch (error) {
      console.error("Failed to hydrate stored analysis:", error);
    }
  }, [
    result,
    reviewAnalysisId,
    resumeId,
    loadingStoredAnalysis,
    latestStoredAnalysis,
    storedResumeData,
    reportLanguage,
  ]);

  /* ── Labels ── */
  const sectionScoreLabels: Record<string, string> = {
    resume_formatting: t.analysis.formatting,
    keyword_optimization: t.analysis.keywords,
    experience_quality: t.analysis.experience,
    career_progression: t.analysis.careerProgression,
    skills_relevance: t.analysis.skills,
    education_strength: t.analysis.education,
    contact_information_quality: t.analysis.contactInfo,
  };
  const breakdownLabels: Record<string, string> = {
    formatting: t.analysis.formatting,
    sections: t.analysis.sections,
    keywords: t.analysis.keywords,
    experience: t.analysis.experience,
    education: t.analysis.education,
    skills: t.analysis.skills,
    contact_info: t.analysis.contactInfo,
  };
  const recruiterLabels: Record<string, string> = {
    first_impression: t.analysis.firstImpression,
    career_clarity: t.analysis.careerClarity,
    achievement_strength: t.analysis.achievementStrength,
    role_alignment: t.analysis.roleAlignment,
    professional_presentation: t.analysis.professionalPresentation,
  };

  /* ── Derived ── */
  const overallStatus = useMemo(() => {
    if (!result) return null;
    if (result.ats_score >= 85)
      return {
        tone: "success",
        title: language === "ar" ? "سيرة قوية وجاهزة للمنافسة" : "Strong interview-ready resume",
        description:
          language === "ar"
            ? "سيرتك جيدة جداً، وتحتاج فقط تحسينات خفيفة."
            : "Your resume is strong and only needs light refinement.",
      };
    if (result.ats_score >= 70)
      return {
        tone: "amber",
        title: language === "ar" ? "أساس جيد لكنه يحتاج تحسينات موجهة" : "Good foundation, needs targeted improvements",
        description:
          language === "ar"
            ? "رفع بعض الأقسام سيزيد فرص المقابلة بشكل واضح."
            : "Improving a few sections should increase interview chances.",
      };
    return {
      tone: "red",
      title: language === "ar" ? "تحتاج إعادة صياغة وتحسين قبل التقديم" : "Needs major optimization before applying",
      description:
        language === "ar"
          ? "يفضل معالجة النقاط الضعيفة أولاً."
          : "Fix the weak areas first before sending to employers.",
    };
  }, [result, language]);

  const lowScoreSections = useMemo(() => {
    if (!result?.section_scores) return [];
    return Object.entries(result.section_scores)
      .map(([key, score]) => ({
        key,
        score: normalizeScore(score),
        label: sectionScoreLabels[key] || key,
        focus: sectionFocusMap[key] || "professionalSummary",
      }))
      .filter((s) => s.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  }, [result, sectionScoreLabels]);

  const priorityFixes = useMemo(() => {
    if (!result) return [];
    const fromQuick = (result.quick_improvements || [])
      .filter((i) => hasText(i.description) || hasText(i.action_step))
      .slice(0, 3)
      .map((item, idx) => ({
        id: `quick-${idx}`,
        title: item.description,
        action: item.action_step,
        focus: idx === 0 ? "professionalSummary" : idx === 1 ? "workExperience" : "skills",
        priority: item.priority || "medium",
      }));
    if (fromQuick.length > 0) return fromQuick;
    const fromRisks = (result.executive_summary?.main_risks || [])
      .filter((r) => hasText(r))
      .slice(0, 3)
      .map((risk, idx) => ({
        id: `risk-${idx}`,
        title: risk,
        action:
          language === "ar" ? "انتقل للمحرر الذكي لمعالجة هذه النقطة." : "Open the AI editor to address this issue.",
        focus: idx === 0 ? "professionalSummary" : idx === 1 ? "workExperience" : "skills",
        priority: "high",
      }));
    if (fromRisks.length > 0) return fromRisks;
    return lowScoreSections.map((s, idx) => ({
      id: `section-${idx}`,
      title: language === "ar" ? `تحسين قسم ${s.label}` : `Improve ${s.label}`,
      action:
        language === "ar"
          ? "ابدأ بهذا القسم لأنه من أقل الأقسام تقييماً."
          : "Start here because this is one of your lowest scoring sections.",
      focus: s.focus,
      priority: "high",
    }));
  }, [result, lowScoreSections, language]);

  const transformationPreview = useMemo(() => {
    const firstQuick = result?.quick_improvements?.find((i) => hasText(i.description) || hasText(i.action_step));
    if (!firstQuick)
      return {
        before:
          language === "ar"
            ? "وصف عام لا يوضح القيمة الحقيقية للمرشح."
            : "Generic wording that does not clearly show the candidate's value.",
        after:
          language === "ar"
            ? "صياغة أقوى توضح الإنجازات والملاءمة الوظيفية."
            : "Stronger wording that highlights achievements and role fit using ATS-friendly language.",
      };
    return {
      before: firstQuick.description,
      after:
        firstQuick.action_step ||
        (language === "ar"
          ? "سيتم تحسين هذا الجزء داخل المحرر الذكي."
          : "This part will be improved inside the smart editor."),
    };
  }, [result, language]);

  const hasBreakdown = hasObject(result?.ats_breakdown || null);
  const hasCareer =
    !!result?.career_recommendations &&
    (hasArray(result.career_recommendations.top_roles) ||
      hasArray(result.career_recommendations.skills_to_improve) ||
      hasArray(result.career_recommendations.certifications_recommended) ||
      hasText(result.career_recommendations.linkedin_improvements) ||
      hasText(result.career_recommendations.thirty_sixty_ninety_day_plan?.thirty_days));
  const hasSalary =
    !!result?.salary_estimation &&
    (hasArray(result.salary_estimation.salary_table) || result.salary_estimation.offer_range_low > 0);
  const hasRecruiterAnalysis = hasObject(result?.recruiter_analysis || null);
  const hasQuickImprovements = hasArray(
    result?.quick_improvements?.filter((i) => hasText(i.description) || hasText(i.action_step)) || [],
  );
  const hasInterviewQuestions = hasArray(result?.interview_questions?.filter((q) => hasText(q.question)) || []);

  const handleCancelAnalysis = () => {
    setAnalyzing(false);
    setStage("uploading");
    setAutoAnalyzeFailed(true);
  };

  /* ── Score ring helper ── */
  const ScoreRing = ({ score }: { score: number }) => {
    const r = 36;
    const circ = 2 * Math.PI * r;
    const fill = (score / 100) * circ;
    return (
      <div className="relative w-28 h-28 flex-shrink-0">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={r} fill="none" strokeWidth="6" className="text-muted/30" stroke="currentColor" />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            strokeWidth="6"
            strokeDasharray={`${fill} ${circ}`}
            strokeLinecap="round"
            style={{ stroke: scoreRingColor(score), transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-black leading-none ${scoreColor(score)}`}>{score}</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">/100</span>
        </div>
      </div>
    );
  };

  /* ── LOADING DIALOG ── */
  const analysisDialog = (
    <Dialog
      open={analyzing}
      onOpenChange={(open) => {
        if (!open) handleCancelAnalysis();
      }}
    >
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <div className="space-y-6 text-center py-4">
          <motion.div
            key={stage}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            {stage === "done" ? (
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-violet-500/15 flex items-center justify-center mx-auto">
                <Brain className="w-8 h-8 text-violet-500 animate-pulse" />
              </div>
            )}
          </motion.div>
          <AnimatePresence mode="wait">
            <motion.p
              key={stage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-base font-bold text-foreground"
            >
              {language === "ar" ? stageConfig[stage].ar : stageConfig[stage].en}
            </motion.p>
          </AnimatePresence>
          <div className="space-y-1.5">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${stageConfig[stage].progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{stageConfig[stage].progress}%</p>
          </div>
          <div className="space-y-1.5 text-start">
            {allStages.slice(0, -1).map((s, i) => {
              const currentIdx = allStages.indexOf(stage);
              const isDone = i < currentIdx;
              const isCurrent = i === currentIdx;
              return (
                <div
                  key={s}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${isCurrent ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : isDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"}`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-current flex-shrink-0" />
                  )}
                  <span>{language === "ar" ? stageConfig[s].ar : stageConfig[s].en}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t.analysis.analyzingSubtext}</p>
          <Button variant="outline" size="sm" onClick={handleCancelAnalysis} className="rounded-lg">
            {language === "ar" ? "إلغاء" : "Cancel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  /* ══════════════════ EMPTY STATE ══════════════════ */
  if (!result) {
    return (
      <div className="min-h-screen bg-background" dir={language === "ar" ? "rtl" : "ltr"}>
        {analysisDialog}
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-md">
          <div className="container max-w-4xl flex items-center gap-3 h-14">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-lg">
              <Link to="/dashboard">
                <ArrowLeft className={`w-4 h-4 ${language === "ar" ? "rotate-180" : ""}`} />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 text-violet-500" />
              </div>
              <span className="font-bold text-sm text-foreground">{t.analysis.title}</span>
            </div>
          </div>
        </header>

        <main className="container max-w-2xl py-12 px-4">
          <div className="text-center space-y-3 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto">
              <Brain className="w-8 h-8 text-violet-500" />
            </div>
            <h2 className="text-2xl font-extrabold text-foreground">
              {selectedResume || resumeId
                ? language === "ar"
                  ? "جارٍ تجهيز تحليل السيرة الذاتية"
                  : "Preparing Resume Analysis"
                : language === "ar"
                  ? "اختر سيرة ذاتية للتحليل"
                  : "Select a Resume to Analyze"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {selectedResume || resumeId
                ? language === "ar"
                  ? "تم تحديد السيرة الذاتية، وسيتم تشغيل التحليل وعرض النتيجة هنا."
                  : "A resume is selected. The analysis will run and the report will appear here."
                : language === "ar"
                  ? "سيحلل الذكاء الاصطناعي سيرتك ويقدم تقريراً شاملاً"
                  : "AI will analyze your resume and provide a detailed report"}
            </p>
          </div>

          {/* Language selector */}
          <div className="flex items-center justify-center gap-3 p-3.5 rounded-xl border border-border bg-card mb-6">
            <span className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "لغة التقرير:" : "Report Language:"}
            </span>
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              {(["ar", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setReportLanguage(lang)}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${reportLanguage === lang ? "bg-violet-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {lang === "ar" ? "العربية" : "English"}
                </button>
              ))}
            </div>
          </div>

          {loadingResumes || loadingStoredAnalysis ? (
            <div className="flex justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "جارٍ تحميل البيانات..." : "Loading data..."}
                </p>
              </div>
            </div>
          ) : selectedResume || (resumeId && userResumes.length > 0) ? (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-violet-500/30 bg-violet-500/5 p-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {selectedResume?.file_name || (language === "ar" ? "السيرة المحددة" : "Selected Resume")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {autoAnalyzeFailed
                        ? language === "ar"
                          ? "تعذّر إكمال التحليل تلقائياً. يمكنك إعادة المحاولة الآن."
                          : "Automatic analysis did not complete. You can retry now."
                        : language === "ar"
                          ? "تم تحديد هذه السيرة للتحليل."
                          : "This resume is selected for analysis."}
                    </p>
                  </div>
                  {(analyzing || (!autoAnalyzeFailed && resumeId)) && (
                    <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 text-sm font-medium">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{language === "ar" ? "جارٍ التحليل..." : "Analyzing..."}</span>
                    </div>
                  )}
                </div>
              </div>

              {storedAnalysisError ? (
                <div className="flex flex-col items-center gap-3 py-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {language === "ar" ? "تعذر تحميل التحليل المحفوظ" : "Could not load saved analysis"}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-md px-4">{storedAnalysisError}</p>
                  </div>
                </div>
              ) : null}

              {autoAnalyzeFailed && (
                <div className="flex flex-col items-center gap-3 py-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-center">
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {language === "ar"
                        ? "تعذّر عرض نتيجة التحليل تلقائياً"
                        : "Could not display the analysis automatically"}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-md px-4">
                      {language === "ar"
                        ? "السيرة محددة بالفعل. أعد المحاولة لتشغيل التحليل على السيرة المختارة."
                        : "The resume is already selected. Retry to run the analysis for the selected resume."}
                    </p>
                  </div>
                  <Button
                    onClick={handleRetrySelectedResume}
                    className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {language === "ar" ? "إعادة المحاولة" : "Retry Analysis"}
                  </Button>
                </div>
              )}
            </div>
          ) : userResumes.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm">
                {language === "ar" ? "لا توجد سير ذاتية مرفوعة بعد." : "No resumes uploaded yet."}
              </p>
              <Button
                onClick={() => navigate("/dashboard")}
                className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white gap-2"
              >
                <Upload className="w-4 h-4" />
                {language === "ar" ? "ارفع سيرة من لوحة التحكم" : "Upload from Dashboard"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {userResumes.map((resume) => {
                const isSelected = (selectedResumeId || resumeId) === resume.id;
                return (
                  <button
                    key={resume.id}
                    onClick={() => handleResumeSelect(resume.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all group text-left ${isSelected ? "border-violet-500 bg-violet-500/5" : "border-border hover:border-violet-400 bg-card hover:bg-violet-500/5"}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-violet-500" : "bg-violet-500/10 group-hover:bg-violet-500"}`}
                    >
                      <FileText
                        className={`w-5 h-5 transition-colors ${isSelected ? "text-white" : "text-violet-500 group-hover:text-white"}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{resume.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(resume.created_at).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <ArrowRight
                      className={`w-4 h-4 transition-all flex-shrink-0 ${isSelected ? "text-violet-500" : "text-muted-foreground group-hover:text-violet-500 group-hover:translate-x-0.5"}`}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>
    );
  }

  const handleGenerateEnhancedResume = async () => {
    if (!resumeId || !storedResumeData || !result) {
      toast.error(
        language === "ar"
          ? "لا توجد بيانات كافية لإنشاء السيرة المحسنة"
          : "Not enough data to generate the enhanced resume",
      );
      return;
    }

    try {
      await rewrite({
        resume: {
          id: resumeId,
          raw_resume_text: storedResumeData.raw_resume_text || "",
          structured_resume_json: storedResumeData.structured_resume_json || {},
          corrections: correctionsDraft,
        },
        analysis: result as unknown as Record<string, unknown>,
        userId: user?.id,
      });

      setActiveTab("enhanced");
      toast.success(language === "ar" ? "تم إنشاء السيرة المحسنة بنجاح" : "Enhanced resume generated successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate enhanced resume";
      if (/insufficient points/i.test(message)) {
        setShowInsufficientPoints(true);
        return;
      }
      console.error("Enhanced resume generation failed:", error);
      toast.error(language === "ar" ? "تعذر إنشاء السيرة المحسنة" : "Could not generate the enhanced resume");
    }
  };

  /* ══════════════════ REPORT VIEW ══════════════════ */
  const ar = language === "ar";
  return (
    <div className="min-h-screen bg-background" dir={ar ? "rtl" : "ltr"}>
      <FlowProgressBar activeStep="analyze" />
      {analysisDialog}
      <style>{`@media print { header,button { display:none!important } body { background:white!important } #analysis-report { max-width:100%!important; padding:0!important } }`}</style>

      {/* HEADER */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="container max-w-5xl flex items-center gap-3 h-14">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-lg">
            <Link to="/dashboard">
              <ArrowLeft className={`w-4 h-4 ${ar ? "rotate-180" : ""}`} />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-violet-500" />
            </div>
            <span className="font-bold text-sm text-foreground hidden sm:block">{t.analysis.title}</span>
          </div>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetrySelectedResume}
              disabled={analyzing}
              className="gap-1.5 rounded-lg text-xs"
            >
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
              {ar ? "إعادة التحليل / Re-analyze" : "Re-analyze / إعادة التحليل"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("enhanced")}
              disabled={!result}
              className="gap-1.5 rounded-lg text-xs"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {ar ? "تحسين السيرة / Enhance Resume" : "Enhance Resume / تحسين السيرة"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 rounded-lg text-xs">
              <Download className="w-3.5 h-3.5" />
              {ar ? "تنزيل / Download" : "Download / تنزيل"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              asChild
              className="gap-1.5 rounded-lg text-xs"
            >
              <Link to="/dashboard/interview-avatar">
                <MessageSquare className="w-3.5 h-3.5" />
                {ar ? "دعوة مقابلة AI / Send AI Interview" : "Send AI Interview / دعوة مقابلة AI"}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="analysis-report" className="container max-w-5xl py-6 px-4">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "overview" | "corrections" | "enhanced")}
          className="space-y-5"
        >
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-muted/60 p-1">
            <TabsTrigger value="overview" className="rounded-xl">
              {ar ? "التحليل" : "Overview"}
            </TabsTrigger>
            <TabsTrigger value="corrections" className="rounded-xl">
              {ar ? "التصحيحات" : "Corrections"}
            </TabsTrigger>
            <TabsTrigger value="enhanced" className="rounded-xl">
              {ar ? "السيرة المحسنة" : "Enhanced Resume"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-5">
            {/* ── HERO SCORE CARD ── */}
            <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-violet-500/8 via-background to-indigo-500/5 p-6">
              <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/8 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-28 h-28 bg-indigo-500/8 rounded-full blur-2xl pointer-events-none" />

              <div className="relative flex flex-col md:flex-row md:items-center gap-6">
                {/* Score ring */}
                <ScoreRing score={result.ats_score} />

                {/* Info */}
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {result.candidate_name && (
                        <span className="text-sm font-bold text-foreground">👤 {result.candidate_name}</span>
                      )}
                      {result.target_role && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Target className="w-3 h-3" />
                          {result.target_role}
                        </Badge>
                      )}
                    </div>
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold
                  ${
                    overallStatus?.tone === "success"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                      : overallStatus?.tone === "amber"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                        : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                  }`}
                    >
                      {overallStatus?.tone === "success" ? (
                        <Trophy className="w-4 h-4" />
                      ) : overallStatus?.tone === "amber" ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      {overallStatus?.title}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">{overallStatus?.description}</p>

                  {/* Quick stats */}
                  <div className="flex flex-wrap gap-2">
                    {result.executive_summary.candidate_level && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium border border-violet-500/20">
                        {result.executive_summary.candidate_level}
                      </span>
                    )}
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border ${result.ats_score >= 80 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" : result.ats_score >= 60 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"}`}
                    >
                      ATS: {result.ats_score}/100
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <Button
                  size="lg"
                  asChild
                  className="flex-shrink-0 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/20 rounded-xl gap-2"
                >
                  <Link to={buildEnhanceUrl(priorityFixes[0]?.focus || "professionalSummary")}>
                    <Sparkles className="w-4 h-4" />
                    {ar ? "تحسين السيرة الآن" : "Improve Now"}
                  </Link>
                </Button>
              </div>
            </div>

            {/* ── PRIORITY FIXES ── */}
            {hasArray(priorityFixes) && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {ar ? "أهم الإصلاحات أولاً" : "Top Priority Fixes"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "أسرع النقاط التي سترفع جودة سيرتك" : "Fastest improvements that lift resume quality"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {priorityFixes.map((item) => (
                    <Link
                      key={item.id}
                      to={buildEnhanceUrl(item.focus)}
                      className="group flex flex-col gap-2 p-3.5 rounded-xl border-2 border-border hover:border-violet-400 bg-background/60 hover:bg-violet-500/5 transition-all"
                    >
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold w-fit ${item.priority === "high" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
                      >
                        {item.priority === "high" ? (ar ? "عالية" : "High") : ar ? "متوسطة" : "Medium"}
                      </span>
                      <p className="text-xs font-semibold text-foreground leading-relaxed">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">{item.action}</p>
                      <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                        {ar ? "إصلاح في المحرر" : "Fix in Editor"}
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ── EXECUTIVE SUMMARY ── */}
            {result.executive_summary && (
              <div className="space-y-3">
                {hasText(result.executive_summary.summary_paragraphs) &&
                  !result.executive_summary.summary_paragraphs.startsWith("This score was generated") &&
                  !result.executive_summary.summary_paragraphs.startsWith("تم إنشاء هذا التقييم") && (
                    <div className="p-5 bg-card rounded-xl border border-border">
                      <div className="flex items-center gap-2 mb-3">
                        <Brain className="w-4 h-4 text-violet-500" />
                        <h3 className="text-sm font-bold text-foreground">
                          {ar ? "الملخص التنفيذي" : "Executive Summary"}
                        </h3>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {result.executive_summary.summary_paragraphs}
                      </p>
                    </div>
                  )}

                {(hasArray(result.executive_summary.best_fit_roles) ||
                  hasArray(result.executive_summary.top_strengths) ||
                  hasArray(result.executive_summary.main_risks)) && (
                  <div className="grid md:grid-cols-3 gap-3">
                    {hasArray(result.executive_summary.best_fit_roles) && (
                      <div className="p-4 bg-card rounded-xl border border-border space-y-2">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-violet-500" />
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                            {t.analysis.bestFitRoles}
                          </h4>
                        </div>
                        <ul className="space-y-1">
                          {result.executive_summary.best_fit_roles
                            .filter((r) => !isJunk(r) && typeof r === "string")
                            .map((r, i) => (
                              <li key={i} className="text-xs text-foreground">
                                • {r}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                    {hasArray(result.executive_summary.top_strengths) && (
                      <div className="p-4 bg-card rounded-xl border border-emerald-500/20 bg-emerald-500/3 space-y-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                            {t.analysis.strengths}
                          </h4>
                        </div>
                        <ul className="space-y-1">
                          {result.executive_summary.top_strengths
                            .filter((s) => !isJunk(s) && typeof s === "string")
                            .map((s, i) => (
                              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                                <span className="text-emerald-500 flex-shrink-0">✓</span>
                                {s}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                    {hasArray(result.executive_summary.main_risks) && (
                      <div className="p-4 bg-card rounded-xl border border-red-500/20 bg-red-500/3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-red-500" />
                          <h4 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">
                            {t.analysis.risks}
                          </h4>
                        </div>
                        <ul className="space-y-1">
                          {result.executive_summary.main_risks
                            .filter((r) => !isJunk(r) && typeof r === "string")
                            .map((r, i) => (
                              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                                <span className="text-red-500 flex-shrink-0">!</span>
                                {r}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── SECTION SCORES ── */}
            {hasObject(result.section_scores) && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-violet-500" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{ar ? "نقاط أقسام السيرة" : "Section Scores"}</h3>
                    <p className="text-xs text-muted-foreground">
                      {ar
                        ? "اضغط على أي قسم للانتقال لمحرر التحسين"
                        : "Click any section to jump to the enhancement editor"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {Object.entries(result.section_scores)
                    .filter(([key, score]) => {
                      const n = normalizeScore(score);
                      return n >= 0 && (sectionScoreLabels[key] !== undefined || key.length < 40);
                    })
                    .sort((a, b) => normalizeScore(a[1]) - normalizeScore(b[1]))
                    .slice(0, 7)
                    .map(([key, score]) => (
                      <ScoreBar
                        key={key}
                        label={
                          sectionScoreLabels[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                        }
                        score={normalizeScore(score)}
                        subtitle={
                          lowScoreSections.some((s) => s.key === key)
                            ? ar
                              ? "من أقل الأقسام — يفضل البدء به"
                              : "One of your lowest — recommended first"
                            : undefined
                        }
                        actionLabel={ar ? "تحسين هذا القسم" : "Improve This Section"}
                        actionTo={buildEnhanceUrl(sectionFocusMap[key] || "professionalSummary")}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* ── BEFORE / AFTER ── */}
            {hasText(transformationPreview.before) &&
              hasText(transformationPreview.after) &&
              transformationPreview.before !== transformationPreview.after && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                      {ar ? "قبل التحسين" : "Before"}
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 rounded-lg p-3">
                      {transformationPreview.before}
                    </p>
                  </div>
                  <div className="rounded-xl border-2 border-violet-500/30 bg-violet-500/5 p-4 space-y-2">
                    <h4 className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />
                      {ar ? "بعد التحسين" : "After"}
                    </h4>
                    <p className="text-sm text-foreground leading-relaxed bg-background/70 rounded-lg p-3">
                      {transformationPreview.after}
                    </p>
                  </div>
                </div>
              )}

            {/* ── ATS BREAKDOWN ── */}
            {hasBreakdown && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-violet-500" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{t.analysis.atsBreakdown}</h3>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "تفصيل كل جانب من جوانب سيرتك" : "Detailed performance of each resume aspect"}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {Object.entries(result.ats_breakdown)
                    .filter(([, data]) => normalizeScore(data.score) >= 0)
                    .slice(0, 7)
                    .map(([key, data]) => (
                      <BreakdownCard
                        key={key}
                        title={breakdownLabels[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        score={normalizeScore(data.score)}
                        currentState={safeText(data.current_state)}
                        problem={safeText(data.problem)}
                        improvement={safeText(data.recommended_improvement)}
                        actionLabel={ar ? "تحسين هذا الجزء" : "Improve This Area"}
                        actionTo={buildEnhanceUrl(sectionFocusMap[key] || "professionalSummary")}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* ── CAREER RECOMMENDATIONS ── */}
            {hasCareer && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-violet-500" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{t.analysis.career}</h3>
                    <p className="text-xs text-muted-foreground">
                      {ar
                        ? "توصيات مهنية مبنية على تحليل سيرتك"
                        : "Career recommendations based on your resume analysis"}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {hasArray(result.career_recommendations.top_roles) && (
                    <div className="p-4 rounded-xl border border-border bg-background/50">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                        {t.analysis.topRoles}
                      </h4>
                      <div className="space-y-2">
                        {result.career_recommendations.top_roles.map((r, i) => (
                          <div key={i} className="p-2.5 bg-muted/40 rounded-lg">
                            <p className="text-xs font-semibold text-foreground">{r.role}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{r.why_it_fits}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(hasArray(result.career_recommendations.skills_to_improve) ||
                    hasArray(result.career_recommendations.certifications_recommended)) && (
                    <div className="grid md:grid-cols-2 gap-3">
                      {hasArray(result.career_recommendations.skills_to_improve) && (
                        <div className="p-4 rounded-xl border border-border bg-background/50">
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                            {t.analysis.skillsToImprove}
                          </h4>
                          <ul className="space-y-1">
                            {result.career_recommendations.skills_to_improve
                              .filter((s) => !isJunk(s) && typeof s === "string")
                              .map((s, i) => (
                                <li key={i} className="text-xs text-foreground">
                                  • {s}
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                      {hasArray(result.career_recommendations.certifications_recommended) && (
                        <div className="p-4 rounded-xl border border-border bg-background/50">
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                            {t.analysis.certifications}
                          </h4>
                          <ul className="space-y-1">
                            {result.career_recommendations.certifications_recommended
                              .filter((c) => !isJunk(c) && typeof c === "string")
                              .map((c, i) => (
                                <li key={i} className="text-xs text-foreground">
                                  • {c}
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {(hasText(result.career_recommendations.thirty_sixty_ninety_day_plan?.thirty_days) ||
                    hasText(result.career_recommendations.thirty_sixty_ninety_day_plan?.sixty_days) ||
                    hasText(result.career_recommendations.thirty_sixty_ninety_day_plan?.ninety_days)) && (
                    <div className="p-4 rounded-xl border border-border bg-background/50">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
                        {t.analysis.actionPlan}
                      </h4>
                      <div className="grid md:grid-cols-3 gap-2">
                        {(["thirty_days", "sixty_days", "ninety_days"] as const).map((period) => {
                          const val = result.career_recommendations.thirty_sixty_ninety_day_plan?.[period];
                          if (!hasText(val)) return null;
                          return (
                            <div key={period} className="p-3 bg-violet-500/8 rounded-lg border border-violet-500/15">
                              <p className="text-xs font-bold text-violet-600 dark:text-violet-400 mb-1">
                                {period === "thirty_days" ? "30" : period === "sixty_days" ? "60" : "90"}{" "}
                                {t.analysis.days}
                              </p>
                              <p className="text-xs text-foreground leading-relaxed">{val}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {hasText(result.career_recommendations.linkedin_improvements) && (
                    <div className="p-4 rounded-xl border border-border bg-background/50">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                        LinkedIn / Portfolio
                      </h4>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {result.career_recommendations.linkedin_improvements}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SALARY ── */}
            {hasSalary && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{t.analysis.salary}</h3>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "تقديرات سوقية بناءً على مستواك" : "Market estimates based on your level"}
                    </p>
                  </div>
                </div>
                {hasArray(result.salary_estimation.salary_table) && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          {[
                            ar ? "الدور" : "Role",
                            ar ? "النطاق الشهري" : "Monthly Range",
                            ar ? "متى الحد الأعلى؟" : "Upper Range When?",
                            ar ? "ملاحظات" : "Notes",
                          ].map((h) => (
                            <th key={h} className="text-start p-2 font-bold text-muted-foreground">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.salary_estimation.salary_table.map((row, i) => (
                          <tr key={i} className="border-b border-border/40">
                            <td className="p-2 font-semibold text-foreground">{row.role}</td>
                            <td className="p-2 text-foreground">
                              {row.monthly_range_low?.toLocaleString()} – {row.monthly_range_high?.toLocaleString()} SAR
                            </td>
                            <td className="p-2 text-muted-foreground">{row.when_upper_range}</td>
                            <td className="p-2 text-muted-foreground">{row.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { label: ar ? "أدنى عرض" : "Offer Low", v: result.salary_estimation.offer_range_low },
                    { label: ar ? "أعلى عرض" : "Offer High", v: result.salary_estimation.offer_range_high },
                    { label: t.analysis.negotiationTarget, v: result.salary_estimation.negotiation_target },
                    { label: ar ? "رقم الفتح" : "Anchor", v: result.salary_estimation.anchor },
                    { label: ar ? "حد القبول" : "Walk-away", v: result.salary_estimation.walk_away },
                  ].map((item) => (
                    <div key={item.label} className="text-center p-3 bg-muted/40 rounded-xl">
                      <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                      <p className="text-sm font-black text-foreground">
                        {item.v?.toLocaleString()}{" "}
                        <span className="text-[10px] text-muted-foreground font-normal">SAR</span>
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {ar
                    ? "⚠️ تقديرات سوقية عامة وليست مصادر مؤكدة."
                    : "⚠️ General market estimates, not confirmed sources."}
                </p>
              </div>
            )}

            {/* ── RECRUITER VIEW ── */}
            {hasRecruiterAnalysis && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-violet-500" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {ar ? "منظور المجنّد" : "Recruiter Perspective"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {ar
                        ? "كيف تبدو سيرتك من زاوية مسؤول التوظيف"
                        : "How your resume appears from a recruiter's point of view"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(result.recruiter_analysis)
                    .filter(([, data]) => normalizeScore(data.score) >= 0 && !isJunk(data.comment))
                    .map(([key, data]) => (
                      <RecruiterItem
                        key={key}
                        label={recruiterLabels[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        score={normalizeScore(data.score)}
                        comment={safeText(data.comment)}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* ── QUICK IMPROVEMENTS ── */}
            {hasQuickImprovements && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{ar ? "تحسينات سريعة" : "Quick Improvements"}</h3>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "خطوات عملية سريعة لرفع جودة السيرة" : "Practical quick wins to improve resume quality"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {dedupeList(result.quick_improvements.filter((i) => !isJunk(i.description)).map((i) => i.description))
                    .slice(0, 5)
                    .map((desc, i) => {
                      const item = result.quick_improvements.find((x) => x.description === desc)!;
                      return (
                        <QuickImprovement
                          key={i}
                          priority={item.priority || "medium"}
                          description={desc}
                          actionStep={safeText(item.action_step)}
                          actionLabel={ar ? "تطبيق في المحرر" : "Apply in Editor"}
                          actionTo={buildEnhanceUrl(
                            i === 0 ? "professionalSummary" : i === 1 ? "workExperience" : "skills",
                          )}
                        />
                      );
                    })}
                </div>
              </div>
            )}

            {/* ── INTERVIEW QUESTIONS ── */}
            {hasInterviewQuestions && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-violet-500" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {ar ? "أسئلة المقابلة المتوقعة" : "Interview Questions"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "أسئلة محتملة مع اتجاهات للإجابة" : "Likely questions with answer directions"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {result.interview_questions
                    .filter((q) => !isJunk(q.question) && typeof q.question === "string")
                    .slice(0, 10)
                    .map((q, i) => (
                      <InterviewQuestion
                        key={i}
                        index={i + 1}
                        question={q.question}
                        direction={safeText(q.suggested_answer_direction)}
                      />
                    ))}
                </div>
                <div className="flex items-center justify-between gap-3 p-4 rounded-xl border-2 border-violet-500/20 bg-violet-500/5">
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {ar ? "تدرّب مع المحاور الذكي" : "Practice with AI Avatar"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "أجب بصوتك واحصل على تقييم فوري" : "Answer by voice and get instant evaluation"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    asChild
                    className="rounded-xl gap-1.5 bg-violet-600 hover:bg-violet-700 text-white flex-shrink-0"
                  >
                    <Link
                      to={`/dashboard/interview-avatar?analysis_id=${searchParams.get("id") || ""}&job_title=${encodeURIComponent(result.target_role || "")}&questions=${encodeURIComponent(JSON.stringify(result.interview_questions.filter((q) => !isJunk(q.question) && typeof q.question === "string").slice(0, 10)))}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {ar ? "ابدأ المقابلة" : "Start Interview"}
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {/* ── BOTTOM CTA ── */}
            <div className="rounded-2xl border-2 border-violet-500/20 bg-gradient-to-br from-violet-500/8 to-indigo-500/5 p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6 text-violet-500" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">
                {ar ? "جاهز لتحسين سيرتك؟" : "Ready to improve your resume?"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {ar
                  ? "انتقل الآن للمحرر الذكي وابدأ من الأقسام الأضعف."
                  : "Open the smart editor and start with your weakest sections."}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  size="lg"
                  asChild
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/20 gap-2"
                >
                  <Link to={buildEnhanceUrl(priorityFixes[0]?.focus || "professionalSummary")}>
                    <Sparkles className="w-4 h-4" />
                    {ar ? "تحسين وإعادة كتابة السيرة" : "Improve Resume"}
                  </Link>
                </Button>
                <Button
                  size="lg"
                  asChild
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 gap-2"
                >
                  <Link to={`/job-search${result?.target_role ? `?q=${encodeURIComponent(result.target_role)}` : ""}`}>
                    <Briefcase className="w-4 h-4" />
                    {ar ? "ابحث عن وظائف مطابقة" : "Find Matching Jobs"}
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="rounded-xl gap-2">
                  <Link to="/dashboard">
                    <ArrowLeft className={`w-4 h-4 ${ar ? "rotate-180" : ""}`} />
                    {ar ? "لوحة التحكم" : "Dashboard"}
                  </Link>
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="corrections" className="mt-0 space-y-5">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {ar ? "التصحيحات والحقول القابلة للمراجعة" : "Corrections and validation"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {ar
                    ? "راجع البيانات الأساسية قبل إنشاء السيرة المحسنة. هذه المرحلة تعرض البيانات المستخرجة فقط بدون إعادة استخراج."
                    : "Review the extracted core fields before generating the enhanced resume. This uses the current stored resume only."}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{ar ? "الاسم الكامل" : "Full name"}</label>
                  <Input
                    value={correctionsDraft.fullName}
                    onChange={(e) => setCorrectionsDraft((prev) => ({ ...prev, fullName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{ar ? "المسمى المستهدف" : "Target title"}</label>
                  <Input
                    value={correctionsDraft.title}
                    onChange={(e) => setCorrectionsDraft((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{ar ? "معلومات التواصل" : "Contact info"}</label>
                <Textarea
                  rows={5}
                  value={correctionsDraft.contact}
                  onChange={(e) => setCorrectionsDraft((prev) => ({ ...prev, contact: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{ar ? "الملخص المهني" : "Professional summary"}</label>
                <Textarea
                  rows={8}
                  value={correctionsDraft.summary}
                  onChange={(e) => setCorrectionsDraft((prev) => ({ ...prev, summary: e.target.value }))}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <h4 className="text-sm font-semibold mb-2">{ar ? "المعلومات الناقصة" : "Missing information"}</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {(
                      [
                        !correctionsDraft.fullName ? (ar ? "الاسم الكامل" : "Full name") : null,
                        !correctionsDraft.title ? (ar ? "المسمى المستهدف" : "Target title") : null,
                        !correctionsDraft.contact ? (ar ? "بيانات التواصل" : "Contact details") : null,
                        !correctionsDraft.summary ? (ar ? "الملخص المهني" : "Professional summary") : null,
                      ].filter(Boolean) as string[]
                    ).map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                    {[
                      correctionsDraft.fullName,
                      correctionsDraft.title,
                      correctionsDraft.contact,
                      correctionsDraft.summary,
                    ].every(Boolean) ? (
                      <li>• {ar ? "لا توجد نواقص أساسية في هذه الحقول." : "No critical gaps in these fields."}</li>
                    ) : null}
                  </ul>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <h4 className="text-sm font-semibold mb-2">{ar ? "الخطوة التالية" : "Next step"}</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {ar
                      ? "بعد مراجعة هذه البيانات، انتقل إلى تبويب السيرة المحسنة لإنشاء نسخة ATS-friendly كاملة داخل نفس الصفحة."
                      : "After reviewing these fields, move to the Enhanced Resume tab to generate a full ATS-friendly rewrite inside the same page."}
                  </p>
                  <Button onClick={() => setActiveTab("enhanced")} className="rounded-xl gap-2">
                    <Wand2 className="w-4 h-4" />
                    {ar ? "الانتقال إلى السيرة المحسنة" : "Go to Enhanced Resume"}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="enhanced" className="mt-0 space-y-5">
            <RewriteSummaryCard
              resume={storedResumeData}
              analysis={{
                overall_score: result?.ats_score || 0,
                full_analysis: result as unknown as Record<string, unknown>,
              }}
              improvementSummary={priorityFixes.slice(0, 4).map((item) => item.title)}
            />

            <RewriteIssuesCard
              analysis={{
                weaknesses: result?.executive_summary?.main_risks || [],
                suggestions: result?.quick_improvements?.map((item) => item.action_step || item.description) || [],
                full_analysis: result as unknown as Record<string, unknown>,
              }}
            />

            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {ar ? "السيرة الذاتية المحسنة / Enhanced Resume" : "Enhanced Resume / السيرة الذاتية المحسنة"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {ar
                      ? "النسخة المعروضة تجمع السيرة الحالية مع نتائج التحليل في مخرج نهائي واضح. التكلفة: 5 نقاط. / The final version combines your current resume with the analysis results. Cost: 5 points."
                      : "The final version combines your current resume with the analysis results. Cost: 5 points. / النسخة المعروضة تجمع السيرة الحالية مع نتائج التحليل في مخرج نهائي واضح."}
                  </p>
                </div>
                <Button
                  onClick={handleGenerateEnhancedResume}
                  disabled={!storedResumeData || !result || rewriteLoading}
                  className="rounded-xl gap-2"
                >
                  {rewriteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {rewriteLoading
                    ? ar
                      ? "جارٍ تجهيز النسخة / Preparing"
                      : "Preparing / جارٍ تجهيز النسخة"
                    : ar
                      ? "تجهيز النسخة النهائية / Generate Final Resume"
                      : "Generate Final Resume / تجهيز النسخة النهائية"}
                </Button>
              </div>

              {rewriteError ? <p className="text-sm text-red-500">{rewriteError}</p> : null}
            </div>

            {rewriteResult?.rewritten_resume ? (
              <RewriteReview
                originalText={storedResumeData?.raw_resume_text || ""}
                improvedText={rewriteResult.rewritten_resume}
                summary={rewriteResult.improvement_summary}
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </main>
      <InsufficientPointsDialog
        open={showInsufficientPoints}
        onClose={() => setShowInsufficientPoints(false)}
        ar={ar}
      />
    </div>
  );
};

export default Analysis;
