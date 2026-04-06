import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import {
  FileText,
  BarChart3,
  Send,
  RefreshCw,
  Loader2,
  Upload,
  Plus,
  Trash2,
  ChevronRight,
  Coins,
  Wand2,
  MessageSquare,
  FileType,
  Calendar,
  Search,
  Sparkles,
  TrendingUp,
  Target,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getReadableUploadErrorMessage, uploadAndParseResume } from "@/hooks/useUserResume";
import { SERVICE_COSTS } from "@/lib/points";
import { ensureUserProfile } from "@/lib/ensure-profile";
import { useCareerFlow } from "@/contexts/CareerFlowContext";

type ResumeRow = Tables<"resumes">;
type ProfileRow = Tables<"profiles">;
type AnalysisRow = Tables<"analyses">;
type MarketingEmailRow = Tables<"marketing_emails">;

type GeneratedResumeRow = {
  id: string;
  source_resume_id: string | null;
  ats_score: number | null;
  title: string;
  created_at: string;
};

type EnhancementSessionRow = {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
  file_path?: string;
};

type InterviewSessionRow = {
  id: string;
  resume_id: string | null;
  overall_score: number | null;
  session_title: string;
  created_at: string;
  job_title: string | null;
};

/* ─── Score color ─── */
const scoreColor = (score: number) => {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
};

const scoreBg = (score: number) => {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
};

const scoreLabel = (score: number, ar: boolean) => {
  if (score >= 80) return ar ? "ممتاز" : "Excellent";
  if (score >= 60) return ar ? "جيد" : "Good";
  return ar ? "يحتاج تحسين" : "Needs Work";
};

/* ─── Journey Step ─── */
interface JourneyStepProps {
  number: number;
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  status: "done" | "active";
  score?: number | null;
  badge?: string;
  onClick: () => void;
  ar: boolean;
}

const JourneyStep = ({
  number,
  icon: Icon,
  title,
  description,
  status,
  score,
  badge,
  onClick,
  ar,
}: JourneyStepProps) => {
  const isDone = status === "done";
  const isActive = status === "active";

  return (
    <button
      onClick={onClick}
      className={`
        group w-full text-left rounded-2xl border-2 p-4 transition-all duration-200 cursor-pointer
        ${
          isDone
            ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/10"
            : "border-border hover:border-violet-400 hover:bg-violet-500/5"
        }
      `}
    >
      <div className="flex items-center gap-4">
        {/* Step indicator */}
        <div
          className={`
          relative flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all
          ${
            isDone
              ? "bg-emerald-500 text-white"
              : "bg-muted text-muted-foreground group-hover:bg-violet-500 group-hover:text-white"
          }
        `}
        >
          {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`
              text-sm font-bold
              ${isDone ? "text-emerald-700 dark:text-emerald-400" : "text-foreground group-hover:text-violet-700 dark:group-hover:text-violet-300"}
            `}
            >
              {title}
            </span>
            {badge && (
              <span
                className={`
                text-[10px] px-2 py-0.5 rounded-full font-semibold
                ${isDone ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}
              `}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>

        {/* Right side */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {isDone && score !== null && score !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className={`text-lg font-black ${scoreColor(score)}`}>{score}</span>
              <div className="w-8 h-8 rounded-full border-2 border-muted flex items-center justify-center relative">
                <svg className="w-8 h-8 absolute" viewBox="0 0 32 32">
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="none"
                    strokeWidth="2"
                    strokeDasharray={`${(score / 100) * 75.4} 75.4`}
                    strokeLinecap="round"
                    className={score >= 80 ? "text-emerald-500" : score >= 60 ? "text-amber-500" : "text-red-500"}
                    style={{ transform: "rotate(-90deg)", transformOrigin: "center", stroke: "currentColor" }}
                  />
                </svg>
              </div>
            </div>
          )}
          {isDone && (score === null || score === undefined) && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {!isDone && (
            <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
              {ar ? "ابدأ" : "Start"}
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>
    </button>
  );
};

/* ══════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════ */
const Dashboard = () => {
  const { user, loading: authLoading, initialized } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ar = language === "ar";
  const mountedRef = useRef(true);
  const { setResumeId: setFlowResumeId } = useCareerFlow();

  const [resumes, setResumes] = useState<ResumeRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [generatedResumes, setGeneratedResumes] = useState<GeneratedResumeRow[]>([]);
  const [enhancementSessions, setEnhancementSessions] = useState<EnhancementSessionRow[]>([]);
  const [marketingEmails, setMarketingEmails] = useState<MarketingEmailRow[]>([]);
  const [interviewSessions, setInterviewSessions] = useState<InterviewSessionRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ResumeRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [buyingPackage, setBuyingPackage] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, [user]);

  const canAfford = (cost: number) => pointsBalance >= cost;

  const getScoreForResume = (resumeId: string): number | null => {
    const analysis = analyses.find((a) => a.resume_id === resumeId);
    return analysis?.overall_score ?? null;
  };

  const getFileType = (fileType: string | null) => {
    if (fileType?.includes("pdf")) return "PDF";
    if (fileType?.includes("word") || fileType?.includes("docx")) return "DOCX";
    return "—";
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(ar ? "ar-SA" : "en-US", { year: "numeric", month: "short", day: "numeric" });

  const loadDashboard = useCallback(async (userId: string) => {
    if (user?.id === userId) {
      await ensureUserProfile(user);
    }
    if (!mountedRef.current) return;
    setDashboardLoading(true);
    setResumesLoading(true);
    setSecondaryLoading(true);
    setDashboardError(null);

    try {
      const [
        resumesRes,
        profileRes,
        pointsRes,
        analysesRes,
        enhanceRes,
        roleRes,
        emailsRes,
        generatedResumesRes,
        interviewRes,
      ] = await Promise.all([
        supabase.from("resumes").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("point_transactions").select("amount").eq("user_id", userId),
        supabase.from("analyses").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase
          .from("enhancement_sessions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin"),
        supabase.from("marketing_emails").select("*").eq("user_id", userId),
        supabase
          .from("generated_resumes")
          .select("id, source_resume_id, ats_score, title, created_at")
          .eq("user_id", userId),
        supabase
          .from("interview_sessions")
          .select("id, resume_id, overall_score, session_title, created_at, job_title")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      if (!mountedRef.current) return;
      if (resumesRes.error) throw new Error(resumesRes.error.message);

      setResumes(resumesRes.data ?? []);
      setProfile(profileRes.data ?? null);
      setPointsBalance(
        pointsRes.data?.reduce((s: number, tx: { amount: number | null }) => s + (tx.amount ?? 0), 0) ?? 0,
      );
      setAnalyses(analysesRes.data ?? []);
      setEnhancementSessions((enhanceRes.data as EnhancementSessionRow[]) ?? []);
      setIsAdmin((roleRes.data?.length ?? 0) > 0);
      setMarketingEmails(emailsRes.data ?? []);
      setGeneratedResumes((generatedResumesRes.data as GeneratedResumeRow[]) ?? []);
      setInterviewSessions((interviewRes.data as InterviewSessionRow[]) ?? []);
    } catch (error) {
      if (mountedRef.current) {
        setDashboardError(error instanceof Error ? error.message : "Failed to load dashboard");
        setResumes([]);
        setProfile(null);
        setPointsBalance(0);
        setAnalyses([]);
        setEnhancementSessions([]);
        setMarketingEmails([]);
        setGeneratedResumes([]);
        setInterviewSessions([]);
        setIsAdmin(false);
      }
    } finally {
      if (mountedRef.current) {
        setDashboardLoading(false);
        setResumesLoading(false);
        setSecondaryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!initialized || authLoading) return;
    if (!user?.id) {
      setDashboardLoading(false);
      setResumesLoading(false);
      setSecondaryLoading(false);
      return;
    }
    void loadDashboard(user.id);
  }, [initialized, authLoading, user?.id, loadDashboard]);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // CV upload limit: max 3
    const cvCount = profile?.cv_upload_count ?? 0;
    if (cvCount >= 3) {
      toast.error(
        ar
          ? "لقد وصلت للحد الأقصى (3 سير ذاتية). احذف واحدة لرفع سيرة جديدة."
          : "You've reached the upload limit (3 CVs). Delete one to upload a new resume.",
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadProgress(0);
    setUploading(true);
    try {
      const { structured, resumeId: newResumeId } = await uploadAndParseResume(user.id, file, {
        onProgress: (value) => setUploadProgress(value),
      });

      // Increment cv_upload_count
      await supabase
        .from("profiles")
        .update({ cv_upload_count: cvCount + 1 } as Record<string, unknown>)
        .eq("user_id", user.id);

      const jobTitle = structured?.job_title || "";
      setFlowResumeId(newResumeId);
      toast.success(
        ar
          ? `تم رفع السيرة بنجاح${jobTitle ? ` — ${jobTitle}` : ""}`
          : `Resume uploaded${jobTitle ? ` — ${jobTitle}` : ""}`,
      );
      await loadDashboard(user.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err || "");
      toast.error(getReadableUploadErrorMessage(message, ar ? "ar" : "en"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !user) return;
    setDeleting(true);
    try {
      await supabase.storage.from("resumes").remove([deleteTarget.file_path]);
      const { error } = await supabase.from("resumes").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success(ar ? "تم الحذف" : "Deleted");
      await loadDashboard(user.id);
      setDeleteTarget(null);
    } catch {
      toast.error(ar ? "فشل الحذف" : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleAction = (action: "analyze" | "enhance" | "publish", resumeId: string) => {
    // Free first analysis — skip points check
    if (action === "analyze" && profile && !profile.free_analysis_used) {
      setFlowResumeId(resumeId);
      navigate(`/analysis?id=${resumeId}`);
      return;
    }
    const costMap = {
      analyze: SERVICE_COSTS.analysis,
      enhance: SERVICE_COSTS.enhancement,
      publish: SERVICE_COSTS.marketing_per_100,
    };
    if (!canAfford(costMap[action])) {
      setUpgradeOpen(true);
      return;
    }
    setFlowResumeId(resumeId);
    const routes = {
      analyze: `/analysis?id=${resumeId}`,
      enhance: `/enhance?resume_id=${resumeId}`,
      publish: `/marketing?resume_id=${resumeId}`,
    };
    navigate(routes[action]);
  };

  /* ─── Selected resume state (drives journey steps) ─── */
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);

  // Auto-select latest resume when data loads
  useEffect(() => {
    if (resumes.length > 0 && !activeResumeId) {
      setActiveResumeId(resumes[0].id);
    }
  }, [resumes, activeResumeId]);

  /* Derived state — all computed from activeResumeId */
  const latestResume = resumes.find((r) => r.id === activeResumeId) ?? resumes[0] ?? null;
  const latestAnalysis = latestResume ? analyses.find((a) => a.resume_id === latestResume.id) : null;
  const latestGenerated = latestResume ? generatedResumes.find((g) => g.source_resume_id === latestResume.id) : null;
  const latestMarketing = latestResume ? marketingEmails.filter((e) => e.selected_resume_id === latestResume.id) : [];
  const latestInterviews = latestResume ? interviewSessions.filter((s) => s.resume_id === latestResume.id) : [];

  const hasResume = resumes.length > 0;
  const hasAnalysis = !!latestAnalysis;
  const hasEnhancement = !!latestGenerated;
  const hasMarketing = latestMarketing.length > 0;
  const hasInterview = latestInterviews.length > 0;

  const completionSteps = [hasResume, hasAnalysis, hasEnhancement, hasMarketing, hasInterview];
  const completionPercent = Math.round((completionSteps.filter(Boolean).length / completionSteps.length) * 100);

  const firstName = profile?.display_name?.split(" ")[0] || "";

  if (!initialized || authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user?.id) return <Navigate to="/login" replace />;

  /* ─── Journey steps config ─── */
  // ALL steps are always accessible — no locked state
  const journeySteps = [
    {
      icon: Upload,
      titleAr: "رفع السيرة الذاتية",
      titleEn: "Upload Resume",
      descAr: "ارفع ملف PDF أو DOCX لبدء رحلتك",
      descEn: "Upload your PDF or DOCX to get started",
      status: hasResume ? "done" : "active",
      score: null,
      badgeAr: hasResume ? `${resumes.length} سيرة` : undefined,
      badgeEn: hasResume ? `${resumes.length} file${resumes.length > 1 ? "s" : ""}` : undefined,
      onClick: handleUploadClick,
    },
    {
      icon: BarChart3,
      titleAr: "تحليل CV",
      titleEn: "CV Analysis",
      descAr: "اكتشف المشاكل التي تمنع قبولك في الوظائف",
      descEn: "Find issues blocking you from getting interviews",
      status: hasAnalysis ? "done" : "active",
      score: latestAnalysis?.overall_score ?? null,
      badgeAr: hasAnalysis ? "تم التحليل" : `${SERVICE_COSTS.analysis} نقاط`,
      badgeEn: hasAnalysis ? "Analyzed" : `${SERVICE_COSTS.analysis} pts`,
      onClick: () =>
        latestResume
          ? hasAnalysis
            ? navigate(`/analysis?id=${latestResume.id}`)
            : handleAction("analyze", latestResume.id)
          : navigate("/analysis"),
    },
    {
      icon: Wand2,
      titleAr: "إعادة كتابة بالذكاء الاصطناعي",
      titleEn: "AI Resume Rewrite",
      descAr: "أعد كتابة سيرتك باحترافية عالية ومتوافقة مع ATS",
      descEn: "Rewrite your resume professionally with AI",
      status: hasEnhancement ? "done" : "active",
      score: latestGenerated?.ats_score ?? null,
      badgeAr: hasEnhancement ? "تم التحسين" : `${SERVICE_COSTS.enhancement} نقاط`,
      badgeEn: hasEnhancement ? "Enhanced" : `${SERVICE_COSTS.enhancement} pts`,
      onClick: () => (latestResume ? navigate(`/enhance?resume_id=${latestResume.id}`) : navigate("/enhance")),
    },
    {
      icon: Send,
      titleAr: "تسويق السيرة",
      titleEn: "Resume Marketing",
      descAr: "أرسل سيرتك إلى عشرات الشركات بضغطة واحدة",
      descEn: "Send your resume to dozens of companies at once",
      status: hasMarketing ? "done" : "active",
      score: null,
      badgeAr: hasMarketing ? `${latestMarketing.length} مُرسل` : undefined,
      badgeEn: hasMarketing ? `${latestMarketing.length} sent` : undefined,
      onClick: () => navigate(`/marketing${latestResume ? `?resume_id=${latestResume.id}` : ""}`),
    },
    {
      icon: MessageSquare,
      titleAr: "تدريب المقابلات",
      titleEn: "Interview Practice",
      descAr: "تدرب على أسئلة واقعية وادخل مقابلتك بثقة",
      descEn: "Practice real questions and walk in confident",
      status: hasInterview ? "done" : "active",
      score: hasInterview ? Math.max(...latestInterviews.map((s) => s.overall_score ?? 0)) : null,
      badgeAr: hasInterview ? `${latestInterviews.length} جلسة` : `${SERVICE_COSTS.interview} نقاط`,
      badgeEn: hasInterview
        ? `${latestInterviews.length} session${latestInterviews.length > 1 ? "s" : ""}`
        : `${SERVICE_COSTS.interview} pts`,
      onClick: () =>
        hasInterview ? navigate("/dashboard/interview-history") : navigate("/dashboard/interview-avatar"),
    },
  ] as const;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background" dir={ar ? "rtl" : "ltr"}>
        <div className="container max-w-5xl mx-auto py-6 md:py-8 px-4 space-y-6">
          {/* ── TOP BAR ── */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
                {ar
                  ? `مرحباً${firstName ? `، ${firstName}` : ""} 👋`
                  : `Welcome back${firstName ? `, ${firstName}` : ""} 👋`}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {ar ? "تابع رحلتك المهنية من هنا" : "Track your career journey from here"}
              </p>
            </div>

            {/* Points + Buy */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3.5 py-2">
                <Coins className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium leading-none">
                    {ar ? "رصيدك" : "Balance"}
                  </p>
                  <p className="text-base font-black text-amber-700 dark:text-amber-300 leading-tight">
                    {dashboardLoading ? "—" : pointsBalance}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setUpgradeOpen(true)}
                className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
                {ar ? "شراء نقاط" : "Buy Points"}
              </Button>
            </div>
          </div>

          {/* ── HERO CARD ── */}
          {!dashboardLoading && (
            <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-violet-500/10 via-background to-indigo-500/5 p-5 md:p-6">
              {/* Decorative blobs */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

              <div className="relative flex flex-col md:flex-row md:items-center gap-5">
                <div className="flex-1 space-y-3">
                  {/* Progress ring + label */}
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                        <circle
                          cx="28"
                          cy="28"
                          r="22"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          className="text-muted/30"
                        />
                        <circle
                          cx="28"
                          cy="28"
                          r="22"
                          fill="none"
                          strokeWidth="4"
                          strokeDasharray={`${(completionPercent / 100) * 138.2} 138.2`}
                          strokeLinecap="round"
                          className="text-violet-500"
                          style={{ stroke: "rgb(139,92,246)" }}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-violet-600 dark:text-violet-400">
                        {completionPercent}%
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {ar ? "مستوى جاهزيتك المهنية" : "Career Readiness"}
                      </p>
                      <p className="font-bold text-foreground">
                        {completionPercent === 100
                          ? ar
                            ? "جاهز تماماً 🚀"
                            : "Fully Ready 🚀"
                          : completionPercent >= 60
                            ? ar
                              ? "تقدم جيد، استمر!"
                              : "Good progress, keep going!"
                            : ar
                              ? "ابدأ رحلتك الآن"
                              : "Start your journey now"}
                      </p>
                    </div>
                  </div>

                  {/* Stats pills */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        icon: FileText,
                        label: ar
                          ? `${resumes.length} سيرة`
                          : `${resumes.length} resume${resumes.length !== 1 ? "s" : ""}`,
                        active: hasResume,
                      },
                      {
                        icon: BarChart3,
                        label: hasAnalysis
                          ? `ATS: ${latestAnalysis?.overall_score}`
                          : ar
                            ? "لم يُحلَّل"
                            : "No analysis",
                        active: hasAnalysis,
                      },
                      {
                        icon: Send,
                        label: ar ? `${latestMarketing.length} مُرسَل` : `${latestMarketing.length} sent`,
                        active: hasMarketing,
                      },
                    ].map((stat, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                        ${stat.active ? "bg-violet-500/10 border-violet-500/20 text-violet-700 dark:text-violet-300" : "bg-muted/40 border-border text-muted-foreground"}`}
                      >
                        <stat.icon className="w-3 h-3" />
                        {stat.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next step CTA */}
                <div className="flex flex-col gap-2 min-w-[200px]">
                  {!hasResume ? (
                    <Button
                      onClick={handleUploadClick}
                      disabled={uploading}
                      size="lg"
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2 shadow-lg shadow-violet-500/25"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploading
                        ? ar
                          ? `جاري الرفع... ${uploadProgress}%`
                          : `Uploading... ${uploadProgress}%`
                        : ar
                          ? "ارفع سيرتك الآن"
                          : "Upload Your Resume"}
                    </Button>
                  ) : !hasAnalysis ? (
                    <Button
                      onClick={() => handleAction("analyze", latestResume!.id)}
                      size="lg"
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2 shadow-lg shadow-violet-500/25"
                    >
                      <BarChart3 className="w-4 h-4" />
                      {ar ? "حلّل سيرتك الآن" : "Analyze Now"}
                    </Button>
                  ) : !hasEnhancement ? (
                    <Button
                      onClick={() => handleAction("enhance", latestResume!.id)}
                      size="lg"
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2 shadow-lg shadow-violet-500/25"
                    >
                      <Wand2 className="w-4 h-4" />
                      {ar ? "حسّن سيرتك بالذكاء" : "AI Rewrite Now"}
                    </Button>
                  ) : !hasMarketing ? (
                    <Button
                      onClick={() => navigate(`/marketing?resume_id=${latestResume!.id}`)}
                      size="lg"
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2 shadow-lg shadow-violet-500/25"
                    >
                      <Send className="w-4 h-4" />
                      {ar ? "سوّق سيرتك" : "Market Resume"}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => navigate("/dashboard/interview-avatar")}
                      size="lg"
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2 shadow-lg shadow-violet-500/25"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {ar ? "تدرّب على المقابلة" : "Practice Interview"}
                    </Button>
                  )}
                  <p className="text-center text-[10px] text-muted-foreground">
                    {ar ? "الخطوة التالية الموصى بها" : "Your recommended next step"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── LEFT: JOURNEY ── */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-violet-500" />
                  {ar ? "رحلتك المهنية" : "Your Career Journey"}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {completionSteps.filter(Boolean).length}/{completionSteps.length} {ar ? "مكتمل" : "complete"}
                </span>
              </div>

              {dashboardLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {journeySteps.map((step, i) => (
                    <JourneyStep
                      key={i}
                      number={i + 1}
                      icon={step.icon}
                      title={ar ? step.titleAr : step.titleEn}
                      description={ar ? step.descAr : step.descEn}
                      status={step.status as "done" | "active"}
                      score={step.score}
                      badge={ar ? step.badgeAr : step.badgeEn}
                      onClick={step.onClick}
                      ar={ar}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── RIGHT: RESUMES ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-violet-500" />
                  {ar ? "سيرك الذاتية" : "Your Resumes"}
                </h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleUploadClick}
                  disabled={uploading}
                  className="h-7 text-xs gap-1 text-violet-600 hover:text-violet-700 hover:bg-violet-500/10"
                >
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {uploading ? `${ar ? "جاري الرفع" : "Uploading"} ${uploadProgress}%` : ar ? "رفع" : "Upload"}
                </Button>
              </div>

              {dashboardError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                    <AlertCircle className="w-4 h-4" />
                    {ar ? "خطأ في التحميل" : "Load error"}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void loadDashboard(user.id)}
                    className="w-full gap-2 text-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {ar ? "إعادة المحاولة" : "Retry"}
                  </Button>
                </div>
              ) : resumesLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-xl" />
                  ))}
                </div>
              ) : resumes.length === 0 ? (
                <button
                  onClick={handleUploadClick}
                  className="w-full rounded-xl border-2 border-dashed border-border hover:border-violet-400 bg-muted/20 hover:bg-violet-500/5 p-8 text-center transition-all duration-200 group"
                >
                  <Upload className="w-8 h-8 text-muted-foreground/40 group-hover:text-violet-500 mx-auto mb-2 transition-colors" />
                  <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {ar ? "ارفع سيرتك الأولى" : "Upload your first resume"}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">PDF أو DOCX</p>
                </button>
              ) : (
                <div className="space-y-2">
                  {resumes.map((resume) => {
                    const score = getScoreForResume(resume.id);
                    const enhanced = generatedResumes.find((g) => g.source_resume_id === resume.id);
                    const isActive = resume.id === (activeResumeId ?? resumes[0]?.id);

                    return (
                      <div
                        key={resume.id}
                        onClick={() => setActiveResumeId(resume.id)}
                        className={`group rounded-xl border-2 transition-all duration-200 overflow-hidden cursor-pointer
                          ${
                            isActive
                              ? "border-violet-500/50 bg-violet-500/5 shadow-md shadow-violet-500/10"
                              : "border-border hover:border-violet-300 dark:hover:border-violet-700 bg-card hover:bg-violet-500/3"
                          }`}
                      >
                        <div className="p-3 flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                              ${isActive ? "bg-violet-500 text-white" : "bg-violet-500/10"}`}
                            >
                              <FileText className={`w-4 h-4 ${isActive ? "text-white" : "text-violet-500"}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold text-foreground truncate max-w-[130px]">
                                  {resume.file_name}
                                </p>
                                {isActive && (
                                  <span className="text-[9px] bg-violet-500 text-white px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                                    {ar ? "نشط" : "Active"}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                                <span>{getFileType(resume.file_type)}</span>
                                <span>·</span>
                                <span>{formatDate(resume.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(resume);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">{ar ? "حذف" : "Delete"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Score bar */}
                        {score !== null && (
                          <div className="px-3 pb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-muted-foreground">ATS Score</span>
                              <span className={`text-xs font-bold ${scoreColor(score)}`}>{score}/100</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${scoreBg(score)}`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Quick actions */}
                        <div className="border-t border-border/40 grid grid-cols-3 divide-x divide-border/40">
                          {[
                            {
                              label: ar ? "تحليل" : "Analyze",
                              icon: BarChart3,
                              done: score !== null,
                              onClick: (e: React.MouseEvent) => {
                                e.stopPropagation();
                                score !== null
                                  ? navigate(`/analysis?id=${resume.id}`)
                                  : handleAction("analyze", resume.id);
                              },
                            },
                            {
                              label: ar ? "تحسين" : "Enhance",
                              icon: Wand2,
                              done: !!enhanced,
                              onClick: (e: React.MouseEvent) => {
                                e.stopPropagation();
                                navigate(`/enhance?resume_id=${resume.id}`);
                              },
                            },
                            {
                              label: ar ? "إرسال" : "Send",
                              icon: Send,
                              done: marketingEmails.some((e) => e.selected_resume_id === resume.id),
                              onClick: (e: React.MouseEvent) => {
                                e.stopPropagation();
                                navigate(`/marketing?resume_id=${resume.id}`);
                              },
                            },
                          ].map((action, i) => (
                            <button
                              key={i}
                              onClick={action.onClick}
                              className={`flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors hover:bg-muted/50
                                ${action.done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
                            >
                              <action.icon className="w-3 h-3" />
                              {action.label}
                              {action.done && <CheckCircle2 className="w-2.5 h-2.5" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Add new */}
                  <button
                    onClick={handleUploadClick}
                    className="w-full rounded-xl border border-dashed border-border/60 hover:border-violet-400 flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground hover:text-violet-600 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {ar ? "رفع سيرة جديدة" : "Upload new resume"}
                  </button>
                </div>
              )}

              {/* Quick Services */}
              <div className="pt-2 space-y-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {ar ? "خدمات سريعة" : "Quick Access"}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      icon: Search,
                      labelAr: "بحث وظائف",
                      labelEn: "Job Search",
                      url: "/job-search",
                      color: "text-blue-500 bg-blue-500/10",
                    },
                    {
                      icon: TrendingUp,
                      labelAr: "بناء السيرة",
                      labelEn: "Resume Builder",
                      url: "/builder",
                      color: "text-indigo-500 bg-indigo-500/10",
                    },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={() => navigate(item.url)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-violet-300 bg-card hover:bg-muted/30 transition-all text-center"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.color}`}>
                        <item.icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-medium text-foreground">
                        {ar ? item.labelAr : item.labelEn}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── INPUT ── */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* ── DELETE DIALOG ── */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-4 h-4" />
                {ar ? "حذف السيرة" : "Delete Resume"}
              </DialogTitle>
              <DialogDescription>
                {ar
                  ? `هل أنت متأكد من حذف "${deleteTarget?.file_name}"؟`
                  : `Delete "${deleteTarget?.file_name}"? This cannot be undone.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting} className="gap-2">
                {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {ar ? "احذف" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── UPGRADE DIALOG ── */}
        <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                {ar ? "احصل على نقاط أكثر" : "Get More Points"}
              </DialogTitle>
              <DialogDescription>
                {ar ? "اشترِ نقاطاً لاستخدام خدمات الذكاء الاصطناعي" : "Purchase points to use AI-powered services"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              {[
                {
                  packageId: "starter",
                  name: ar ? "المبتدئ" : "Starter",
                  points: 30,
                  price: "29",
                  features: ar ? ["10 تحليل", "6 تحسينات", "6 مقابلات"] : ["10 analyses", "6 rewrites", "6 interviews"],
                },
                {
                  packageId: "pro",
                  name: ar ? "المحترف" : "Pro",
                  points: 100,
                  price: "79",
                  popular: true,
                  features: ar
                    ? ["33 تحليل", "20 تحسين", "20 مقابلة"]
                    : ["33 analyses", "20 rewrites", "20 interviews"],
                },
                {
                  packageId: "business",
                  name: ar ? "الأعمال" : "Business",
                  points: 300,
                  price: "149",
                  features: ar
                    ? ["100 تحليل", "60 تحسين", "60 مقابلة"]
                    : ["100 analyses", "60 rewrites", "60 interviews"],
                },
              ].map((pack) => (
                <div
                  key={pack.packageId}
                  className={`rounded-xl border p-4 transition-all
                  ${"popular" in pack && pack.popular ? "border-violet-500 bg-violet-500/5 shadow-md shadow-violet-500/10" : "border-border hover:border-violet-300"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{pack.name}</span>
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Coins className="w-2.5 h-2.5" /> {pack.points}
                      </Badge>
                      {"popular" in pack && pack.popular && (
                        <Badge className="text-xs bg-violet-500 text-white border-0">
                          {ar ? "الأكثر شيوعاً" : "Popular"}
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-bold">
                      {pack.price} {ar ? "ر.س" : "SAR"}
                      <span className="text-xs text-muted-foreground font-normal">{ar ? "/شهر" : "/mo"}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {pack.features.map((f) => (
                      <span key={f} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        {f}
                      </span>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={"popular" in pack && pack.popular ? "default" : "outline"}
                    disabled={buyingPackage === pack.packageId}
                    onClick={async () => {
                      setBuyingPackage(pack.packageId);
                      try {
                        const { data, error } = await supabase.functions.invoke("paymob-checkout", {
                          body: { packageId: pack.packageId },
                        });
                        if (error) throw error;
                        if (!data?.checkout_url) throw new Error("No checkout URL");
                        window.location.href = data.checkout_url;
                      } catch {
                        toast.error(ar ? "فشل إنشاء جلسة الدفع" : "Failed to create checkout");
                      } finally {
                        setBuyingPackage(null);
                      }
                    }}
                  >
                    {buyingPackage === pack.packageId ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                        {ar ? "جاري التحويل..." : "Redirecting..."}
                      </>
                    ) : ar ? (
                      "اشترِ الآن"
                    ) : (
                      "Buy Now"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default Dashboard;
