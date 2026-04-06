/**
 * TALENTRY — RecruiterAIInterview.tsx
 *
 * The full AI interview conductor.
 * Route: /recruiter/interview/:sessionId
 *
 * Flow:
 *  1. Load session (questions + candidate + job)
 *  2. Display questions one-by-one
 *  3. Recruiter types or dictates answer (voice via SpeechRecognition)
 *  4. Submit all → evaluate via edge function
 *  5. Auto-redirect to /recruiter/interview/:sessionId/results
 *
 * NO DEAD ENDS: every state has a clear next action.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  SkipForward,
  Send,
  User,
  Briefcase,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useEvaluateInterview } from "@/hooks/useInterviewJourney";

// ─── Category styling ─────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  technical: { label: "Technical", color: "text-blue-700", bg: "bg-blue-100" },
  behavioral: { label: "Behavioral", color: "text-purple-700", bg: "bg-purple-100" },
  hr: { label: "HR / General", color: "text-green-700", bg: "bg-green-100" },
  cv_clarification: { label: "CV Clarification", color: "text-amber-700", bg: "bg-amber-100" },
  red_flag: { label: "Red Flag", color: "text-red-700", bg: "bg-red-100" },
  situational: { label: "Situational", color: "text-orange-700", bg: "bg-orange-100" },
  motivational: { label: "Motivational", color: "text-teal-700", bg: "bg-teal-100" },
  cultural: { label: "Cultural", color: "text-indigo-700", bg: "bg-indigo-100" },
};

function getCategoryBadge(cat: string) {
  const cfg = CATEGORY_CONFIG[cat] || { label: cat, color: "text-gray-700", bg: "bg-gray-100" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Question {
  category: string;
  question: string;
  why_it_matters: string;
  strong_answer_signals: string;
}

interface Answer {
  question_index: number;
  answer: string;
}

interface SessionData {
  id: string;
  candidate_id: string;
  job_id: string | null;
  questions: Question[];
  answers: Answer[];
  status: string;
  mode: string;
}

interface CandidateData {
  id: string;
  name: string;
  email: string | null;
  current_title: string | null;
  extracted_text: string | null;
}

interface JobData {
  id: string;
  title: string;
  description: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQuestion(value: unknown): value is Question {
  return (
    isRecord(value) &&
    typeof value.category === "string" &&
    typeof value.question === "string" &&
    typeof value.why_it_matters === "string" &&
    typeof value.strong_answer_signals === "string"
  );
}

function isAnswer(value: unknown): value is Answer {
  return isRecord(value) && typeof value.question_index === "number" && typeof value.answer === "string";
}

function normalizeQuestions(value: unknown): Question[] {
  return Array.isArray(value) ? value.filter(isQuestion) : [];
}

function normalizeAnswers(value: unknown): Answer[] {
  return Array.isArray(value) ? value.filter(isAnswer) : [];
}

function normalizeSession(value: unknown): SessionData | null {
  if (!isRecord(value)) return null;

  const id = value.id;
  const candidateId = value.candidate_id;
  const jobId = value.job_id;
  const status = value.status;
  const mode = value.mode;

  if (
    typeof id !== "string" ||
    typeof candidateId !== "string" ||
    !(typeof jobId === "string" || jobId === null) ||
    typeof status !== "string" ||
    typeof mode !== "string"
  ) {
    return null;
  }

  return {
    id: id as string,
    candidate_id: candidateId as string,
    job_id: jobId as string | null,
    questions: normalizeQuestions(value.questions),
    answers: normalizeAnswers(value.answers),
    status: status as string,
    mode: mode as string,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
const RecruiterAIInterview = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ar = language === "ar";

  const [session, setSession] = useState<SessionData | null>(null);
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startedAt] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);

  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { evaluate } = useEvaluateInterview();

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ── Load session ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!sessionId || !user) return;
    setLoading(true);
    try {
      const { data: sess, error } = await supabase
        .from("recruiter_interview_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("recruiter_id", user.id)
        .single();

      if (error || !sess) {
        toast.error(ar ? "الجلسة غير موجودة" : "Session not found");
        navigate("/recruiter/interviews");
        return;
      }

      // If already completed, redirect to results
      if (sess.status === "completed") {
        navigate(`/recruiter/interview/${sessionId}/results`);
        return;
      }

      const sessionData = normalizeSession(sess);
      if (!sessionData) {
        toast.error(ar ? "بيانات الجلسة غير صالحة" : "Invalid session data");
        navigate("/recruiter/interviews");
        return;
      }

      setSession(sessionData);

      // Restore any previously saved answers
      if (sessionData.answers.length > 0) {
        setAnswers(sessionData.answers);
        setCurrentIndex(Math.min(sessionData.answers.length, Math.max(sessionData.questions.length - 1, 0)));
      }

      // Load candidate
      const { data: cand } = await supabase
        .from("recruiter_candidates")
        .select("id, name, email, current_title, extracted_text")
        .eq("id", sess.candidate_id)
        .single();
      setCandidate(cand as CandidateData | null);

      // Load job if linked
      if (sess.job_id) {
        const { data: jobData } = await supabase
          .from("recruiter_jobs")
          .select("id, title, description")
          .eq("id", sess.job_id)
          .single();
        setJob(jobData as JobData | null);
      }

      // Mark as started
      if (sess.status === "pending") {
        await supabase
          .from("recruiter_interview_sessions")
          .update({ status: "in_progress", started_at: new Date().toISOString() })
          .eq("id", sessionId);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, user, navigate, ar]);

  useEffect(() => {
    load();
  }, [load]);

  // Restore current answer if navigating back
  useEffect(() => {
    const saved = answers.find((a) => a.question_index === currentIndex);
    setCurrentAnswer(saved?.answer || "");
    setShowHint(false);
  }, [currentIndex, answers]);

  // ── Speech recognition ─────────────────────────────────────────────────────
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(ar ? "المتصفح لا يدعم التعرف على الصوت" : "Browser doesn't support voice recognition");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = ar ? "ar-SA" : "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      setCurrentAnswer((prev) => {
        const base = prev.trimEnd();
        return base ? `${base} ${transcript}` : transcript;
      });
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  // ── Save answer to state ───────────────────────────────────────────────────
  const saveCurrentAnswer = useCallback(
    (answerText: string = currentAnswer) => {
      setAnswers((prev) => {
        const existing = prev.findIndex((a) => a.question_index === currentIndex);
        const updated = { question_index: currentIndex, answer: answerText.trim() };
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = updated;
          return next;
        }
        return [...prev, updated];
      });
    },
    [currentIndex, currentAnswer],
  );

  // Auto-save to DB every 30s
  useEffect(() => {
    if (!sessionId || !session) return;
    const interval = setInterval(async () => {
      if (answers.length > 0) {
        await supabase
          .from("recruiter_interview_sessions")
          .update({ answers: answers as any })
          .eq("id", sessionId);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [sessionId, answers, session]);

  const goNext = () => {
    if (isListening) stopListening();
    saveCurrentAnswer();
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (isListening) stopListening();
    saveCurrentAnswer();
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const skipQuestion = () => {
    saveCurrentAnswer("(Skipped)");
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  // ── Submit all answers for evaluation ─────────────────────────────────────
  const handleSubmit = async () => {
    if (!session || !candidate || !sessionId) return;
    if (isListening) stopListening();

    // Save the current answer before submitting
    const finalAnswers = (() => {
      const existing = answers.findIndex((a) => a.question_index === currentIndex);
      const updated = { question_index: currentIndex, answer: currentAnswer.trim() };
      if (existing >= 0) {
        const next = [...answers];
        next[existing] = updated;
        return next;
      }
      return [...answers, updated];
    })();

    const answered = finalAnswers.filter((a) => a.answer && a.answer !== "(Skipped)").length;
    if (answered === 0) {
      toast.error(ar ? "يرجى الإجابة على سؤال واحد على الأقل" : "Please answer at least one question");
      return;
    }

    setSubmitting(true);
    try {
      // Save answers to DB
      await supabase
        .from("recruiter_interview_sessions")
        .update({ answers: finalAnswers as any })
        .eq("id", sessionId);

      // Evaluate
      const result = await evaluate({
        sessionId,
        candidate,
        job,
        questions,
        answers: finalAnswers,
        language,
      });

      if (result) {
        toast.success(ar ? "تم تقييم المقابلة بنجاح" : "Interview evaluated successfully");
        navigate(`/recruiter/interview/${sessionId}/results`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{ar ? "جاري تحميل المقابلة..." : "Loading interview..."}</p>
      </div>
    );
  }

  if (!session || !candidate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 p-6">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-base font-medium text-foreground">{ar ? "لم يتم العثور على الجلسة" : "Session not found"}</p>
        <Button onClick={() => navigate("/recruiter/interviews")}>
          <ArrowLeft size={14} className="mr-2" />
          {ar ? "العودة للمقابلات" : "Back to Interviews"}
        </Button>
      </div>
    );
  }

  const questions = normalizeQuestions(session.questions);
  const question = questions[currentIndex];
  const progress = Math.round(((currentIndex + 1) / questions.length) * 100);
  const answeredCount = answers.filter((a) => a.answer && a.answer !== "(Skipped)").length;
  const isLast = currentIndex === questions.length - 1;
  const isAnswered = answers.some((a) => a.question_index === currentIndex && a.answer && a.answer !== "(Skipped)");

  return (
    <div
      className="min-h-screen bg-background"
      style={{ fontFamily: "'DM Sans', 'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/recruiter/candidates/${candidate.id}`)}>
            <ArrowLeft size={14} className="mr-1.5" />
            {ar ? "خروج" : "Exit"}
          </Button>

          <div className="flex-1 max-w-xs">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>
                {ar
                  ? `سؤال ${currentIndex + 1} من ${questions.length}`
                  : `Question ${currentIndex + 1} of ${questions.length}`}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {formatTime(elapsed)}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 size={13} className="text-green-500" />
            <span>
              {answeredCount}/{questions.length} {ar ? "أُجيب" : "answered"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* ── Candidate + Job context ────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User size={13} className="text-primary" />
            </div>
            <span className="font-medium text-foreground">{candidate.name}</span>
            {candidate.current_title && <span>· {candidate.current_title}</span>}
          </div>
          {job && (
            <>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1.5">
                <Briefcase size={13} />
                <span>{job.title}</span>
              </div>
            </>
          )}
          <div className="ml-auto">
            <Badge variant="outline" className="text-[10px]">
              <Brain size={9} className="mr-1" />
              {ar ? "مقابلة AI داخلية" : "Internal AI Interview"}
            </Badge>
          </div>
        </div>

        {/* ── Question Card ──────────────────────────────────────────────────── */}
        {question && (
          <Card className="overflow-hidden border-2 border-border hover:border-primary/20 transition-colors">
            {/* Question header */}
            <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {getCategoryBadge(question.category)}
                  {isAnswered && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                      <CheckCircle2 size={10} />
                      {ar ? "تمت الإجابة" : "Answered"}
                    </span>
                  )}
                </div>
                <p className="text-base font-semibold text-foreground leading-relaxed">{question.question}</p>
              </div>
              <span className="text-3xl font-bold text-muted-foreground/30 shrink-0 leading-none">
                {String(currentIndex + 1).padStart(2, "0")}
              </span>
            </div>

            {/* Answer area */}
            <div className="p-6 space-y-4">
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  placeholder={
                    ar
                      ? "اكتب إجابة المرشح هنا، أو اضغط على الميكروفون للإملاء بالصوت..."
                      : "Type the candidate's answer here, or press the mic to dictate..."
                  }
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  className="min-h-[160px] resize-none bg-background text-sm leading-relaxed pr-14"
                  disabled={submitting}
                />
                {/* Mic button */}
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  disabled={submitting}
                  className={`absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                    isListening
                      ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-200"
                      : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                {isListening && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs text-red-500">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    {ar ? "جاري الاستماع..." : "Listening..."}
                  </div>
                )}
              </div>

              {/* Hint toggle */}
              <button
                type="button"
                onClick={() => setShowHint((v) => !v)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                {showHint
                  ? ar
                    ? "▲ إخفاء التلميحات"
                    : "▲ Hide hints"
                  : ar
                    ? "▼ عرض ما تبحث عنه"
                    : "▼ Show what a strong answer looks like"}
              </button>

              {showHint && (
                <div className="rounded-lg bg-primary/5 border border-primary/15 p-4 space-y-2 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-primary mb-1">
                      {ar ? "لماذا هذا السؤال مهم:" : "Why this question matters:"}
                    </p>
                    <p className="text-muted-foreground leading-relaxed">{question.why_it_matters}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-green-600 mb-1">
                      {ar ? "علامات الإجابة القوية:" : "Strong answer signals:"}
                    </p>
                    <p className="text-muted-foreground leading-relaxed">{question.strong_answer_signals}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── Navigation ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={goPrev} disabled={currentIndex === 0 || submitting}>
            <ArrowLeft size={14} className="mr-1.5" />
            {ar ? "السابق" : "Previous"}
          </Button>

          <div className="flex items-center gap-2">
            {!isLast && (
              <Button
                variant="ghost"
                size="sm"
                onClick={skipQuestion}
                disabled={submitting}
                className="text-muted-foreground hover:text-foreground"
              >
                <SkipForward size={14} className="mr-1.5" />
                {ar ? "تخطي" : "Skip"}
              </Button>
            )}

            {isLast ? (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || answeredCount === 0}
                className="bg-green-600 hover:bg-green-700 text-white min-w-[160px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {ar ? "جاري التقييم..." : "Evaluating..."}
                  </>
                ) : (
                  <>
                    <Send size={14} className="mr-2" />
                    {ar ? "إنهاء وتقييم المقابلة" : "Submit & Evaluate"}
                  </>
                )}
              </Button>
            ) : (
              <Button size="sm" onClick={goNext} disabled={submitting}>
                {ar ? "التالي" : "Next"}
                <ArrowRight size={14} className="ml-1.5" />
              </Button>
            )}
          </div>
        </div>

        {/* ── Question navigation dots ───────────────────────────────────────── */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {questions.map((_, i) => {
            const isAnsweredDot = answers.some((a) => a.question_index === i && a.answer && a.answer !== "(Skipped)");
            const isSkipped = answers.some((a) => a.question_index === i && a.answer === "(Skipped)");
            const isCurrent = i === currentIndex;
            return (
              <button
                key={i}
                onClick={() => {
                  saveCurrentAnswer();
                  setCurrentIndex(i);
                }}
                className={`h-7 w-7 rounded-full text-[11px] font-semibold transition-all border-2 ${
                  isCurrent
                    ? "bg-primary text-primary-foreground border-primary scale-110"
                    : isAnsweredDot
                      ? "bg-green-500 text-white border-green-500"
                      : isSkipped
                        ? "bg-amber-300 text-amber-900 border-amber-300"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                }`}
                disabled={submitting}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* ── Submit shortcut (visible from any question if >50% answered) ─── */}
        {answeredCount >= Math.ceil(questions.length * 0.5) && !isLast && (
          <Card className="p-4 flex items-center justify-between gap-4 border-green-200 bg-green-50">
            <div>
              <p className="text-sm font-medium text-green-800">
                {ar
                  ? `أجبت على ${answeredCount} من ${questions.length} أسئلة — يمكنك التقييم الآن`
                  : `You've answered ${answeredCount} of ${questions.length} questions — ready to evaluate`}
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                {ar ? "سيتم تخطي الأسئلة التي لم تُجب عليها" : "Unanswered questions will be skipped"}
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 text-white shrink-0"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send size={14} className="mr-1.5" />
                  {ar ? "تقييم الآن" : "Evaluate Now"}
                </>
              )}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default RecruiterAIInterview;
