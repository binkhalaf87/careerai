/**
 * TALENTRY — RecruiterInterviewResults.tsx
 *
 * Interview results page — shown after AI evaluation completes.
 * Route: /recruiter/interview/:sessionId/results
 *
 * Displays:
 *  - Overall score (animated ring)
 *  - Hiring recommendation: Strong Hire / Hire / Consider / Reject
 *  - Strengths & weak answers
 *  - Per-question answer + score breakdown
 *  - Evaluation summary
 *
 * Actions:
 *  - Move to Hired
 *  - Move to Rejected
 *  - Keep in Pipeline (shortlisted / under review)
 *  - Start New Interview
 *  - View Full Profile
 *
 * NO DEAD ENDS.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Briefcase,
  Loader2,
  Star,
  ThumbsDown,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  MessageSquareText,
  Send,
  Clock,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SessionResult {
  id: string;
  candidate_id: string;
  job_id: string | null;
  questions: Array<{ category: string; question: string }>;
  answers: Array<{ question_index: number; answer: string; score?: number; feedback?: string }>;
  overall_score: number | null;
  recommendation: string | null;
  strengths: string[] | null;
  weak_answers: string[] | null;
  evaluation_summary: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

interface CandidateData {
  id: string;
  name: string;
  email: string | null;
  current_title: string | null;
  stage: string;
}

interface JobData {
  id: string;
  title: string;
}

// ─── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, recommendation }: { score: number; recommendation: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (score / 100) * circumference;

  const recConfig: Record<string, { color: string; strokeColor: string; bg: string; label: string }> = {
    "Strong Hire": { color: "text-green-600", strokeColor: "#16a34a", bg: "bg-green-50", label: "Strong Hire" },
    Hire: { color: "text-blue-600", strokeColor: "#2563eb", bg: "bg-blue-50", label: "Hire" },
    Consider: { color: "text-amber-600", strokeColor: "#d97706", bg: "bg-amber-50", label: "Consider" },
    Reject: { color: "text-red-600", strokeColor: "#dc2626", bg: "bg-red-50", label: "Reject" },
  };
  const cfg = recConfig[recommendation] || recConfig["Consider"];

  return (
    <div className={`flex flex-col items-center rounded-2xl p-8 ${cfg.bg} border border-current/10`}>
      <svg width="140" height="140" className="rotate-[-90deg]">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={cfg.strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="mt-[-116px] flex flex-col items-center z-10">
        <span className={`text-4xl font-bold leading-none ${cfg.color}`}>{score}</span>
        <span className="text-sm text-muted-foreground mt-1">/ 100</span>
      </div>
      <div className={`mt-8 font-semibold text-lg ${cfg.color}`}>{cfg.label}</div>
    </div>
  );
}

// ─── Score color ──────────────────────────────────────────────────────────────
function scoreColor(score?: number) {
  if (!score) return "text-muted-foreground";
  if (score >= 80) return "text-green-600 font-bold";
  if (score >= 60) return "text-blue-600 font-bold";
  if (score >= 40) return "text-amber-600 font-bold";
  return "text-red-500 font-bold";
}

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  hr: "HR",
  cv_clarification: "CV",
  red_flag: "Red Flag",
  situational: "Situational",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQuestionItem(value: unknown): value is { category: string; question: string } {
  return isRecord(value) && typeof value.category === "string" && typeof value.question === "string";
}

function isAnswerItem(
  value: unknown,
): value is { question_index: number; answer: string; score?: number; feedback?: string } {
  return (
    isRecord(value) &&
    typeof value.question_index === "number" &&
    typeof value.answer === "string" &&
    (value.score === undefined || typeof value.score === "number") &&
    (value.feedback === undefined || typeof value.feedback === "string")
  );
}

function normalizeSessionResult(value: unknown): SessionResult | null {
  if (!isRecord(value)) return null;

  const id = value.id;
  const candidateId = value.candidate_id;
  const jobId = value.job_id;
  const status = value.status;

  if (
    typeof id !== "string" ||
    typeof candidateId !== "string" ||
    !(typeof jobId === "string" || jobId === null) ||
    typeof status !== "string"
  ) {
    return null;
  }

  return {
    id: id as string,
    candidate_id: candidateId as string,
    job_id: jobId as string | null,
    questions: Array.isArray(value.questions) ? value.questions.filter(isQuestionItem) : [],
    answers: Array.isArray(value.answers) ? value.answers.filter(isAnswerItem) : [],
    overall_score: typeof value.overall_score === "number" ? value.overall_score : null,
    recommendation: typeof value.recommendation === "string" ? value.recommendation : null,
    strengths: Array.isArray(value.strengths)
      ? value.strengths.filter((item): item is string => typeof item === "string")
      : null,
    weak_answers: Array.isArray(value.weak_answers)
      ? value.weak_answers.filter((item): item is string => typeof item === "string")
      : null,
    evaluation_summary: typeof value.evaluation_summary === "string" ? value.evaluation_summary : null,
    status: status as string,
    started_at: typeof value.started_at === "string" ? value.started_at : null,
    completed_at: typeof value.completed_at === "string" ? value.completed_at : null,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
const RecruiterInterviewResults = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ar = language === "ar";

  const [session, setSession] = useState<SessionResult | null>(null);
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageSaving, setStageSaving] = useState(false);
  const [expandedAnswers, setExpandedAnswers] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId || !user) return;
    setLoading(true);
    try {
      const { data: sess } = await supabase
        .from("recruiter_interview_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("recruiter_id", user.id)
        .single();

      if (!sess) {
        toast.error(ar ? "النتائج غير موجودة" : "Results not found");
        navigate("/recruiter/interviews");
        return;
      }

      // If not completed yet, redirect to interview
      if (sess.status !== "completed") {
        navigate(`/recruiter/interview/${sessionId}`);
        return;
      }

      const sessionResult = normalizeSessionResult(sess);
      if (!sessionResult) {
        toast.error(ar ? "بيانات النتائج غير صالحة" : "Invalid results data");
        navigate("/recruiter/interviews");
        return;
      }

      setSession(sessionResult);

      const { data: cand } = await supabase
        .from("recruiter_candidates")
        .select("id, name, email, current_title, stage")
        .eq("id", sess.candidate_id)
        .single();
      setCandidate(cand as CandidateData | null);

      if (sess.job_id) {
        const { data: jobData } = await supabase
          .from("recruiter_jobs")
          .select("id, title")
          .eq("id", sess.job_id)
          .single();
        setJob(jobData as JobData | null);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, user, navigate, ar]);

  useEffect(() => {
    load();
  }, [load]);

  const moveToStage = async (stage: string) => {
    if (!candidate) return;
    setStageSaving(true);
    try {
      await supabase.from("recruiter_candidates").update({ stage }).eq("id", candidate.id);
      setCandidate((prev) => (prev ? { ...prev, stage } : null));
      toast.success(
        stage === "hired"
          ? ar
            ? "🎉 تم تعيين المرشح!"
            : "🎉 Candidate hired!"
          : stage === "rejected"
            ? ar
              ? "المرشح مرفوض"
              : "Candidate rejected"
            : ar
              ? "تم تحديث المرحلة"
              : "Stage updated",
      );
    } finally {
      setStageSaving(false);
    }
  };

  const startNewInterview = async () => {
    if (!candidate || !user) return;
    setStageSaving(true);
    try {
      const { data: newSession, error } = await supabase
        .from("recruiter_interview_sessions")
        .insert({
          recruiter_id: user.id,
          candidate_id: candidate.id,
          job_id: session?.job_id || null,
          mode: "internal",
          status: "pending",
          questions: session?.questions || [],
          answers: [],
        })
        .select("id")
        .single();

      if (error) throw error;
      navigate(`/recruiter/interview/${newSession.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to start new session");
    } finally {
      setStageSaving(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{ar ? "جاري تحميل النتائج..." : "Loading results..."}</p>
      </div>
    );
  }

  if (!session || !candidate) return null;

  const score = session.overall_score ?? 0;
  const recommendation = session.recommendation || "Consider";
  const strengths = Array.isArray(session.strengths) ? session.strengths : [];
  const weakAnswers = Array.isArray(session.weak_answers) ? session.weak_answers : [];
  const questions = Array.isArray(session.questions) ? session.questions : [];
  const answers = Array.isArray(session.answers) ? session.answers : [];
  const isHired = candidate.stage === "hired";
  const isRejected = candidate.stage === "rejected";

  const duration =
    session.started_at && session.completed_at
      ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60000)
      : null;

  return (
    <div
      className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6"
      style={{ fontFamily: "'DM Sans', 'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ── Back ──────────────────────────────────────────────────────────── */}
      <Button variant="ghost" size="sm" onClick={() => navigate(`/recruiter/candidates/${candidate.id}`)}>
        <ArrowLeft size={14} className="mr-1.5" />
        {ar ? "العودة للملف" : "Back to Profile"}
      </Button>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Brain size={20} className="text-primary" />
            {ar ? "نتائج المقابلة AI" : "AI Interview Results"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <User size={13} />
              {candidate.name}
            </span>
            {job && (
              <span className="flex items-center gap-1.5">
                <Briefcase size={13} />
                {job.title}
              </span>
            )}
            {duration && (
              <span className="flex items-center gap-1.5">
                <Clock size={13} />
                {duration} {ar ? "دقيقة" : "min"}
              </span>
            )}
          </div>
        </div>
        <Badge
          className={`text-sm px-3 py-1 ${
            candidate.stage === "hired"
              ? "bg-emerald-100 text-emerald-700"
              : candidate.stage === "rejected"
                ? "bg-red-100 text-red-700"
                : candidate.stage === "ai_interview_completed"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-muted text-muted-foreground"
          }`}
        >
          {candidate.stage.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* ── Main results grid ─────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* LEFT: Score ring + recommendation */}
        <div className="space-y-4">
          <ScoreRing score={score} recommendation={recommendation} />

          {/* Action buttons */}
          {!isHired && !isRejected && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {ar ? "القرار النهائي" : "Hiring Decision"}
              </p>
              {(recommendation === "Strong Hire" || recommendation === "Hire") && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => moveToStage("hired")}
                  disabled={stageSaving}
                >
                  {stageSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 size={15} className="mr-2" />
                  )}
                  {ar ? "✅ تعيين المرشح" : "✅ Move to Hired"}
                </Button>
              )}
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => moveToStage("shortlisted")}
                disabled={stageSaving}
              >
                <Star size={14} className="mr-2" />
                {ar ? "إبقاء في القائمة المختصرة" : "Keep in Shortlist"}
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => moveToStage("under_review")}
                disabled={stageSaving}
              >
                {ar ? "إعادة للمراجعة" : "Back to Review"}
              </Button>
              <Button
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                variant="ghost"
                onClick={() => moveToStage("rejected")}
                disabled={stageSaving}
              >
                <ThumbsDown size={14} className="mr-2" />
                {ar ? "رفض المرشح" : "Reject Candidate"}
              </Button>
            </div>
          )}

          {/* Already decided */}
          {(isHired || isRejected) && (
            <Card
              className={`p-4 text-center ${isHired ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
            >
              {isHired ? (
                <>
                  <CheckCircle2 size={24} className="text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-green-700">{ar ? "تم التعيين 🎉" : "Hired 🎉"}</p>
                </>
              ) : (
                <>
                  <XCircle size={24} className="text-red-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-red-600">{ar ? "مرفوض" : "Rejected"}</p>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => moveToStage("shortlisted")}
                disabled={stageSaving}
              >
                {ar ? "تراجع عن القرار" : "Undo Decision"}
              </Button>
            </Card>
          )}

          {/* Secondary actions */}
          <div className="space-y-2 pt-2">
            <Button variant="outline" size="sm" className="w-full" onClick={startNewInterview} disabled={stageSaving}>
              <RotateCcw size={13} className="mr-1.5" />
              {ar ? "إجراء مقابلة جديدة" : "Run New Interview"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => navigate(`/recruiter/candidates/${candidate.id}`)}
            >
              <User size={13} className="mr-1.5" />
              {ar ? "عرض الملف الكامل" : "View Full Profile"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() =>
                navigate(`/recruiter/questions?candidate=${candidate.id}&name=${encodeURIComponent(candidate.name)}`)
              }
            >
              <MessageSquareText size={13} className="mr-1.5" />
              {ar ? "أسئلة مقابلة جديدة" : "New Question Set"}
            </Button>
          </div>
        </div>

        {/* RIGHT: Details */}
        <div className="space-y-4">
          {/* Summary */}
          {session.evaluation_summary && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <TrendingUp size={14} className="text-primary" />
                {ar ? "ملخص التقييم" : "Evaluation Summary"}
              </h3>
              <p className="text-sm text-muted-foreground leading-7">{session.evaluation_summary}</p>
            </Card>
          )}

          {/* Strengths + Weak answers */}
          <div className="grid md:grid-cols-2 gap-4">
            {strengths.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-500" />
                  {ar ? "نقاط القوة في المقابلة" : "Interview Strengths"}
                </h3>
                <ul className="space-y-2">
                  {strengths.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-green-500 mt-1 shrink-0">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {weakAnswers.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-500" />
                  {ar ? "مجالات التحسين" : "Areas for Improvement"}
                </h3>
                <ul className="space-y-2">
                  {weakAnswers.map((w, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-amber-500 mt-1 shrink-0">•</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {/* Per-answer breakdown */}
          {answers.length > 0 && (
            <Card className="overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedAnswers((v) => !v)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MessageSquareText size={14} className="text-primary" />
                  {ar ? "تفاصيل الإجابات" : "Answer Breakdown"}
                  <Badge variant="secondary" className="text-[10px]">
                    {answers.length}
                  </Badge>
                </h3>
                {expandedAnswers ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {expandedAnswers && (
                <div className="border-t border-border divide-y divide-border">
                  {answers.map((a, idx) => {
                    const q = questions[a.question_index];
                    if (!q) return null;
                    const cat = CATEGORY_LABELS[q.category] || q.category;
                    const answerScore = a.score;
                    return (
                      <div key={idx} className="p-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                              {cat}
                            </span>
                            <p className="text-sm font-medium text-foreground">{q.question}</p>
                          </div>
                          {answerScore != null && (
                            <div className="shrink-0 text-end">
                              <span className={`text-base font-bold ${scoreColor(answerScore)}`}>{answerScore}</span>
                              <p className="text-[10px] text-muted-foreground">/ 100</p>
                            </div>
                          )}
                        </div>
                        {answerScore != null && (
                          <Progress value={Math.max(0, Math.min(100, answerScore))} className="h-1.5 mb-2" />
                        )}
                        {a.answer && a.answer !== "(Skipped)" ? (
                          <p className="text-sm text-muted-foreground leading-relaxed italic bg-muted/30 rounded-lg p-3">
                            "{a.answer}"
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">{ar ? "(تم التخطي)" : "(Skipped)"}</p>
                        )}
                        {a.feedback && (
                          <p className="text-xs text-primary mt-2 leading-relaxed">
                            <span className="font-semibold">{ar ? "التغذية الراجعة: " : "Feedback: "}</span>
                            {a.feedback}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* ── Next Step Card ────────────────────────────────────────────────── */}
      <Card className="p-5 bg-primary/5 border-primary/20">
        <h3 className="text-sm font-semibold text-foreground mb-3">{ar ? "⚡ الخطوة التالية" : "⚡ Next Steps"}</h3>
        <div className="flex flex-wrap gap-2">
          {(recommendation === "Strong Hire" || recommendation === "Hire") && !isHired && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => moveToStage("hired")}
              disabled={stageSaving}
            >
              <CheckCircle2 size={13} className="mr-1.5" /> {ar ? "تعيين المرشح" : "Hire Candidate"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate(`/recruiter/candidates`)}>
            {ar ? "العودة لقائمة المرشحين" : "All Candidates"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/recruiter/candidates?action=upload")}>
            <Send size={13} className="mr-1.5" /> {ar ? "رفع مرشح جديد" : "Upload Next CV"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default RecruiterInterviewResults;
