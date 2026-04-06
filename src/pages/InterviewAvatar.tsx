import { useState, useEffect, useRef, useCallback } from "react";
import { deductPoints } from "@/lib/points";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useCareerFlow } from "@/contexts/CareerFlowContext";
import FlowProgressBar from "@/components/career-flow/FlowProgressBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Mic,
  MicOff,
  Play,
  Square,
  SkipForward,
  RotateCcw,
  Video,
  VideoOff,
  Volume2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  User,
  MessageSquare,
  Star,
  TrendingUp,
  ChevronRight,
  Brain,
  Shield,
  BarChart3,
  Calendar,
  History,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useInterviewSession, type InterviewQuestion, type AnswerEvaluation, type QuestionCategory } from "@/hooks/useInterviewSession";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PageState = "setup" | "interview" | "summary";

const InterviewAvatar = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ar = language === "ar";
  const { markStep } = useCareerFlow();

  const [pageState, setPageState] = useState<PageState>("setup");
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [currentEvaluation, setCurrentEvaluation] = useState<AnswerEvaluation | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [preloadedQuestions, setPreloadedQuestions] = useState<InterviewQuestion[]>([]);
  const [jobTitle, setJobTitle] = useState("");
  const [cvSummary, setCvSummary] = useState("");
  const [hasGreeted, setHasGreeted] = useState(false);
  const [setupTab, setSetupTab] = useState<string>("new");
  const [historySessions, setHistorySessions] = useState<{ id: string; session_title: string; job_title: string | null; overall_score: number | null; summary_json: any; created_at: string }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const resumeId = searchParams.get("resume_id") || undefined;
  const analysisIdParam = searchParams.get("analysis_id") || undefined;
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | undefined>(analysisIdParam);
  const [analysisList, setAnalysisList] = useState<{ id: string; overall_score: number; created_at: string; section_scores: any }[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(!analysisIdParam);

  const analysisId = selectedAnalysisId;

  const speech = useSpeechRecognition();
  const tts = useSpeechSynthesis();
  const interview = useInterviewSession();

  // Load user analyses for selection
  useEffect(() => {
    if (!user || analysisIdParam) return;
    setLoadingAnalyses(true);
    supabase
      .from("analyses")
      .select("id, overall_score, created_at, section_scores")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setAnalysisList(data as any);
        setLoadingAnalyses(false);
      });
  }, [user, analysisIdParam]);

  // Load interview history
  useEffect(() => {
    if (!user) return;
    setLoadingHistory(true);
    supabase
      .from("interview_sessions" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setHistorySessions(data as any);
        setLoadingHistory(false);
      });
  }, [user]);

  // Load questions from analysis
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setLoadingQuestions(true);

      const questionsParam = searchParams.get("questions");
      if (questionsParam) {
        try {
          const parsed = JSON.parse(decodeURIComponent(questionsParam));
          setPreloadedQuestions(parsed);
        } catch { /* ignore */ }
      }

      const jt = searchParams.get("job_title");
      if (jt) setJobTitle(decodeURIComponent(jt));

      // Load from analysis if we have an analysis_id
      if (analysisId) {
        const { data } = await supabase
          .from("analyses")
          .select("section_scores, resume_id")
          .eq("id", analysisId)
          .single();

        if (data?.section_scores) {
          const scores = data.section_scores as any;
          if (scores.interview_questions && Array.isArray(scores.interview_questions)) {
            setPreloadedQuestions(scores.interview_questions);
          }
          if (scores.target_role) setJobTitle(scores.target_role);
        }
      }

      // Load CV summary if we have resume_id
      const rid = resumeId || searchParams.get("resume_id");
      if (rid) {
        const { data: resume } = await supabase
          .from("resumes")
          .select("extracted_text")
          .eq("id", rid)
          .single();
        if (resume?.extracted_text) {
          setCvSummary(resume.extracted_text.slice(0, 500));
        }
      }

      // Default questions if none loaded
      setLoadingQuestions(false);
    };

    loadData();
  }, [user, analysisId, resumeId, searchParams]);

  // General/HR questions - always included
  const hrQuestions: InterviewQuestion[] = [
    { question: ar ? "أخبرني عن نفسك وخبراتك المهنية." : "Tell me about yourself and your professional experience.", category: "hr" },
    { question: ar ? "ما هي أبرز نقاط قوتك؟" : "What are your key strengths?", category: "hr" },
    { question: ar ? "لماذا تريد ترك وظيفتك الحالية؟" : "Why do you want to leave your current position?", category: "hr" },
    { question: ar ? "أين ترى نفسك بعد خمس سنوات؟" : "Where do you see yourself in five years?", category: "hr" },
    { question: ar ? "هل لديك أي أسئلة لنا؟" : "Do you have any questions for us?", category: "hr" },
  ];

  // Tag preloaded (analysis) questions as professional
  const professionalQuestions: InterviewQuestion[] = preloadedQuestions.map((q) => ({
    ...q,
    category: "professional" as QuestionCategory,
  }));

  // Combine: HR first, then professional from analysis
  const questionsToUse = [...hrQuestions, ...professionalQuestions];

  // Helper: get section label for current question
  const getSectionLabel = (index: number): { label: string; isFirst: boolean } | null => {
    const q = questionsToUse[index];
    if (!q) return null;
    const cat = q.category || "hr";
    const isFirst = index === 0 || questionsToUse[index - 1]?.category !== cat;
    if (!isFirst) return null;
    return {
      label: cat === "hr"
        ? (ar ? "القسم الأول: أسئلة عامة و HR" : "Section 1: General & HR Questions")
        : (ar ? "القسم الثاني: أسئلة مهنية من تحليل السيرة الذاتية" : "Section 2: Professional Questions from CV Analysis"),
      isFirst: true,
    };
  };

  // Camera
  const toggleCamera = useCallback(async () => {
    if (cameraEnabled) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraEnabled(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraEnabled(true);
      setCameraError(false);
    } catch {
      setCameraError(true);
      toast.error(ar ? "لا يمكن الوصول للكاميرا" : "Cannot access camera");
    }
  }, [cameraEnabled, ar]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      tts.cancel();
    };
  }, []);

  // Start interview
  const handleStartInterview = async () => {
    if (!user) return;
    try {
      // Deduct points
      const pointResult = await deductPoints(user.id, "interview", "AI Interview Session");
      if (!pointResult.success) {
        toast.error(ar ? "رصيدك لا يكفي. يرجى شراء نقاط إضافية." : "Insufficient points. Please buy more points.");
        return;
      }

      await interview.startSession({
        userId: user.id,
        resumeId,
        analysisId,
        jobTitle,
        questions: questionsToUse,
      });
      setPageState("interview");
      setCurrentEvaluation(null);

      // Greet
      const greeting = ar
        ? "مرحبًا بك في مقابلتك التجريبية. سأكون المحاور اليوم. لنبدأ بأسئلة متعلقة بملفك الشخصي."
        : "Hello, and welcome to your mock interview. I will act as your interviewer today. Let's begin with a few questions related to your profile and target role.";

      await tts.speak(greeting, ar ? "ar-SA" : "en-US");
      setHasGreeted(true);
    } catch (e) {
      toast.error(ar ? "فشل بدء المقابلة" : "Failed to start interview");
    }
  };

  // Speak current question
  const speakCurrentQuestion = useCallback(async () => {
    if (interview.currentQuestionIndex < interview.questions.length) {
      const q = interview.questions[interview.currentQuestionIndex].question;
      await tts.speak(q, ar ? "ar-SA" : "en-US");
    }
  }, [interview.currentQuestionIndex, interview.questions, tts, ar]);

  useEffect(() => {
    if (pageState === "interview" && hasGreeted && !tts.isSpeaking && interview.status === "ready" && !currentEvaluation) {
      speakCurrentQuestion();
    }
  }, [interview.currentQuestionIndex, hasGreeted, pageState]);

  // Start/stop listening
  const handleStartAnswer = () => {
    speech.resetTranscript();
    setCurrentEvaluation(null);
    speech.startListening(ar ? "ar-SA" : "en-US");
  };

  const handleStopAnswer = async () => {
    speech.stopListening();
    const transcript = speech.transcript.trim() || manualInput.trim();
    if (!transcript) {
      toast.error(ar ? "لم يتم التقاط أي إجابة" : "No answer captured");
      return;
    }

    const evaluation = await interview.submitAnswer(transcript, jobTitle, cvSummary, language);
    if (evaluation) {
      setCurrentEvaluation(evaluation);
      // Speak feedback summary
      const feedback = ar
        ? `تقييمك: ${evaluation.score} من 10. ${evaluation.confidence_assessment}`
        : `Your score: ${evaluation.score} out of 10. ${evaluation.confidence_assessment}`;
      await tts.speak(feedback, ar ? "ar-SA" : "en-US");
    }
  };

  const handleNextQuestion = () => {
    setCurrentEvaluation(null);
    speech.resetTranscript();
    setManualInput("");
    interview.nextQuestion();
  };

  const handleEndInterview = async () => {
    await interview.endSession();
    setPageState("summary");
    markStep("interview");
  };

  // Status indicator
  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    speaking: { label: ar ? "يتحدث" : "Speaking", color: "bg-primary", icon: Volume2 },
    listening: { label: ar ? "يستمع" : "Listening", color: "bg-success", icon: Mic },
    evaluating: { label: ar ? "يُقيّم" : "Evaluating", color: "bg-amber-500", icon: Brain },
    ready: { label: ar ? "جاهز" : "Ready", color: "bg-muted-foreground", icon: CheckCircle2 },
    completed: { label: ar ? "مكتمل" : "Completed", color: "bg-success", icon: CheckCircle2 },
  };

  const currentStatus = tts.isSpeaking ? "speaking" : speech.isListening ? "listening" : interview.status;
  const statusInfo = statusConfig[currentStatus] || statusConfig.ready;
  const StatusIcon = statusInfo.icon;

  const progressPercent = interview.questions.length > 0
    ? ((interview.currentQuestionIndex + (currentEvaluation ? 1 : 0)) / interview.questions.length) * 100
    : 0;

  // SETUP PAGE
  if (pageState === "setup") {
    return (
      <div className="min-h-screen bg-background" dir={ar ? "rtl" : "ltr"}>
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
          <div className="container flex h-16 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft size={18} className={ar ? "rotate-180" : ""} />
            </Button>
            <Link to="/dashboard" className="font-display text-lg font-bold text-foreground">
              TALEN<span className="text-primary">TRY</span>
            </Link>
            <span className="text-border/60 hidden sm:inline">/</span>
            <span className="font-display font-semibold text-foreground text-sm hidden sm:block">
              {ar ? "المقابلة الذكية" : "AI Interview Avatar"}
            </span>
          </div>
        </header>

        <main className="container py-8 max-w-2xl space-y-6">
          <Tabs value={setupTab} onValueChange={setSetupTab} dir={ar ? "rtl" : "ltr"}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new" className="gap-2">
                <Play size={14} />
                {ar ? "مقابلة جديدة" : "New Interview"}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History size={14} />
                {ar ? "سجل المقابلات" : "Interview History"}
                {historySessions.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ms-1">
                    {historySessions.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="mt-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border bg-card p-6 text-center space-y-4"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <User size={36} className="text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  {ar ? "مقابلة تجريبية بالذكاء الاصطناعي" : "AI Mock Interview"}
                </h2>
                <p className="text-sm text-muted-foreground font-body max-w-md mx-auto">
                  {ar
                    ? "سيقوم المحاور الذكي بطرح الأسئلة والاستماع لإجاباتك وتقييم أدائك فوريًا."
                    : "The AI interviewer will ask questions, listen to your answers, and evaluate your performance instantly."}
                </p>

                {/* Analysis selector */}
                {!analysisIdParam && (
                  <div className={`text-${ar ? "right" : "left"} space-y-2`}>
                    <label className="text-sm font-medium text-foreground font-display">
                      {ar ? "اختر تحليل السيرة الذاتية (لبناء أسئلة مهنية)" : "Select a CV Analysis (for professional questions)"}
                    </label>
                    {loadingAnalyses ? (
                      <div className="flex items-center justify-center gap-2 py-4">
                        <Loader2 size={16} className="animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">{ar ? "جارٍ التحميل..." : "Loading..."}</span>
                      </div>
                    ) : analysisList.length === 0 ? (
                      <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                        <p className="text-sm text-muted-foreground font-body">{ar ? "لا توجد تحليلات. قم بتحليل سيرتك الذاتية أولًا." : "No analyses found. Analyze your resume first."}</p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate("/analysis")}>
                          {ar ? "اذهب للتحليل" : "Go to Analysis"}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {analysisList.map((a) => {
                          const scores = a.section_scores as any;
                          const role = scores?.target_role || "";
                          return (
                            <button
                              key={a.id}
                              onClick={() => setSelectedAnalysisId(a.id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-${ar ? "right" : "left"} ${
                                selectedAnalysisId === a.id
                                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                  : "border-border bg-background hover:border-primary/40"
                              }`}
                            >
                              <BarChart3 size={18} className={selectedAnalysisId === a.id ? "text-primary" : "text-muted-foreground"} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-display font-medium text-foreground">
                                  {ar ? "نتيجة ATS" : "ATS Score"}: {a.overall_score}/100
                                  {role && <span className="text-muted-foreground font-body"> · {role}</span>}
                                </p>
                                <p className="text-xs text-muted-foreground font-body">
                                  {new Date(a.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              {selectedAnalysisId === a.id && <CheckCircle2 size={18} className="text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {loadingQuestions ? (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 size={20} className="animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">{ar ? "جارٍ تحميل الأسئلة..." : "Loading questions..."}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageSquare size={14} />
                        {questionsToUse.length} {ar ? "أسئلة" : "questions"}
                      </span>
                      <span className="text-xs">
                        ({hrQuestions.length} {ar ? "عامة" : "HR"} + {professionalQuestions.length} {ar ? "مهنية" : "Professional"})
                      </span>
                      {jobTitle && (
                        <span className="flex items-center gap-1">
                          <TrendingUp size={14} />
                          {jobTitle}
                        </span>
                      )}
                    </div>

                    <div className="rounded-xl bg-muted/50 p-3 flex items-start gap-2 text-xs text-muted-foreground">
                      <Shield size={14} className="shrink-0 mt-0.5" />
                      <span>{ar ? "لن يتم تسجيل أو حفظ الفيديو أو الصوت. يتم تحليل نص الإجابة فقط." : "Your video is never recorded or stored. Only your answer transcript is analyzed."}</span>
                    </div>

                    <Button onClick={handleStartInterview} size="lg" className="gap-2" disabled={!analysisIdParam && !selectedAnalysisId}>
                      <Play size={18} />
                      {ar ? "ابدأ المقابلة" : "Start Interview"}
                    </Button>
                  </>
                )}
              </motion.div>
            </TabsContent>

            <TabsContent value="history" className="mt-6 space-y-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-primary" />
                </div>
              ) : historySessions.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"
                >
                  <MessageSquare size={32} className="mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-foreground font-display">
                    {ar ? "لا توجد مقابلات سابقة" : "No interview sessions yet"}
                  </p>
                  <p className="text-sm text-muted-foreground font-body mt-1 mb-4">
                    {ar ? "ابدأ أول مقابلة تجريبية مع الذكاء الاصطناعي" : "Start your first mock interview with AI"}
                  </p>
                  <Button onClick={() => setSetupTab("new")} className="gap-2">
                    <Play size={16} />
                    {ar ? "ابدأ مقابلة" : "Start Interview"}
                  </Button>
                </motion.div>
              ) : (
                historySessions.map((session, i) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl border border-border bg-card p-5 hover:border-primary/20 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display font-semibold text-foreground text-sm">{session.session_title}</h3>
                      {session.overall_score != null && (
                        <Badge className={`${session.overall_score >= 7 ? "bg-success" : session.overall_score >= 5 ? "bg-primary" : "bg-destructive"} text-white`}>
                          <Star size={10} className="me-1" />
                          {Math.round(session.overall_score * 10) / 10}/10
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {session.job_title && <span>{session.job_title}</span>}
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(session.created_at).toLocaleDateString(ar ? "ar-SA" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                      {session.summary_json?.answered && (
                        <span>{session.summary_json.answered}/{session.summary_json.total_questions} {ar ? "أسئلة" : "Q"}</span>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    );
  }

  // SUMMARY PAGE
  if (pageState === "summary") {
    const avgScore = interview.overallScore || 0;
    const answered = interview.answers.length;
    const best = interview.answers.reduce((b, a) => (!b || (a.evaluation?.score || 0) > (b.evaluation?.score || 0) ? a : b), interview.answers[0]);
    const worst = interview.answers.reduce((w, a) => (!w || (a.evaluation?.score || 0) < (w.evaluation?.score || 0) ? a : w), interview.answers[0]);

    return (
      <div className="min-h-screen bg-background" dir={ar ? "rtl" : "ltr"}>
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
          <div className="container flex h-16 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft size={18} className={ar ? "rotate-180" : ""} />
            </Button>
            <Link to="/dashboard" className="font-display text-lg font-bold text-foreground">
              TALEN<span className="text-primary">TRY</span>
            </Link>
            <span className="text-border/60 hidden sm:inline">/</span>
            <span className="font-display font-semibold text-foreground text-sm hidden sm:block">
              {ar ? "ملخص المقابلة" : "Interview Summary"}
            </span>
          </div>
        </header>

        <main className="container py-8 max-w-2xl space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Score */}
            <div className="rounded-2xl border border-primary/20 bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground font-body mb-2">{ar ? "الدرجة الإجمالية" : "Overall Score"}</p>
              <p className={`text-5xl font-bold font-display ${avgScore >= 7 ? "text-success" : avgScore >= 5 ? "text-primary" : "text-destructive"}`}>
                {Math.round(avgScore * 10) / 10}<span className="text-lg text-muted-foreground">/10</span>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {answered}/{interview.questions.length} {ar ? "أسئلة تمت الإجابة عليها" : "questions answered"}
              </p>
            </div>

            {/* Best/Worst */}
            {best && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-success/20 bg-success/5 p-4">
                  <p className="text-xs font-medium text-success mb-1">{ar ? "أقوى إجابة" : "Strongest Answer"}</p>
                  <p className="text-sm text-foreground font-body line-clamp-2">{best.questionText}</p>
                  <p className="text-lg font-bold text-success mt-1">{best.evaluation?.score}/10</p>
                </div>
                {worst && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                    <p className="text-xs font-medium text-destructive mb-1">{ar ? "تحتاج تحسين" : "Needs Improvement"}</p>
                    <p className="text-sm text-foreground font-body line-clamp-2">{worst.questionText}</p>
                    <p className="text-lg font-bold text-destructive mt-1">{worst.evaluation?.score}/10</p>
                  </div>
                )}
              </div>
            )}

            {/* All answers */}
            <div className="space-y-3">
              {interview.answers.map((a, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Q{a.questionIndex + 1}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      {questionsToUse[a.questionIndex]?.category === "professional" ? (ar ? "مهني" : "Professional") : (ar ? "عام" : "HR")}
                    </Badge>
                    <span className="ml-auto">
                      <Badge variant={a.evaluation && a.evaluation.score >= 7 ? "default" : "secondary"}>
                        {a.evaluation?.score}/10
                      </Badge>
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">{a.questionText}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.transcript}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => { setPageState("setup"); }} variant="outline" className="gap-2">
                <RotateCcw size={16} />
                {ar ? "إعادة المقابلة" : "Retry Interview"}
              </Button>
              <Button onClick={() => navigate("/dashboard")} className="gap-2">
                <ArrowLeft size={16} className={ar ? "rotate-180" : ""} />
                {ar ? "العودة للوحة التحكم" : "Return to Dashboard"}
              </Button>
              <Button onClick={() => { setPageState("setup"); setSetupTab("history"); }} variant="outline" className="gap-2">
                <History size={16} />
                {ar ? "سجل المقابلات" : "View History"}
              </Button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  // INTERVIEW PAGE
  const currentQ = interview.questions[interview.currentQuestionIndex];
  const isLastQuestion = interview.currentQuestionIndex >= interview.questions.length - 1;

  return (
    <div className="min-h-screen bg-background" dir={ar ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft size={18} className={ar ? "rotate-180" : ""} />
            </Button>
            <Link to="/dashboard" className="font-display text-lg font-bold text-foreground hidden sm:block">
              TALEN<span className="text-primary">TRY</span>
            </Link>
            <span className="text-border/60 hidden sm:inline">/</span>
            <div>
              <p className="font-display text-sm font-bold text-foreground">
                {ar ? "المقابلة الذكية" : "AI Interview"}
              </p>
              <p className="text-xs text-muted-foreground">
                {ar ? `سؤال ${interview.currentQuestionIndex + 1} من ${interview.questions.length}` : `Question ${interview.currentQuestionIndex + 1} of ${interview.questions.length}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${statusInfo.color} text-white gap-1 text-xs`}>
              <StatusIcon size={12} />
              {statusInfo.label}
            </Badge>
          </div>
        </div>
        <Progress value={progressPercent} className="h-1" />
      </header>

      <main className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* LEFT - Avatar */}
          <div className="space-y-4">
            {/* Avatar card */}
            <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center relative">
                {/* Avatar animation */}
                <motion.div
                  animate={tts.isSpeaking ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="flex flex-col items-center"
                >
                  <div className={`h-24 w-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                    tts.isSpeaking ? "bg-primary shadow-lg shadow-primary/30" : "bg-primary/20"
                  }`}>
                    <User size={48} className={tts.isSpeaking ? "text-primary-foreground" : "text-primary"} />
                  </div>
                  {tts.isSpeaking && (
                    <div className="flex gap-1 mt-3">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [8, 20, 8] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                          className="w-1 bg-primary rounded-full"
                        />
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Camera preview */}
                {cameraEnabled && (
                  <div className="absolute bottom-3 end-3 w-28 h-20 rounded-lg overflow-hidden border-2 border-card shadow-lg">
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="p-3 flex items-center justify-between border-t border-border">
                <span className="text-xs text-muted-foreground font-body">
                  {ar ? "المحاور الذكي" : "AI Interviewer"}
                </span>
                <Button variant="ghost" size="sm" onClick={toggleCamera} className="gap-1 text-xs">
                  {cameraEnabled ? <VideoOff size={14} /> : <Video size={14} />}
                  {cameraEnabled ? (ar ? "إيقاف الكاميرا" : "Camera Off") : (ar ? "تشغيل الكاميرا" : "Camera On")}
                </Button>
              </div>
            </div>

            {/* Privacy note */}
            <div className="rounded-xl bg-muted/50 p-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Shield size={14} className="shrink-0 mt-0.5" />
              <span>{ar ? "لن يتم تسجيل أو حفظ الفيديو. يتم تحليل نص الإجابة فقط." : "Video is never recorded or stored. Only transcript text is analyzed."}</span>
            </div>
          </div>

          {/* RIGHT - Interview content */}
          <div className="space-y-4">
            {/* Section label */}
            {(() => {
              const section = getSectionLabel(interview.currentQuestionIndex);
              return section ? (
                <motion.div
                  key={section.label}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-2.5 flex items-center gap-2"
                >
                  <Brain size={14} className="text-primary shrink-0" />
                  <span className="text-xs font-display font-semibold text-primary">{section.label}</span>
                </motion.div>
              ) : null;
            })()}

            {/* Current question */}
            <div className="rounded-2xl border border-primary/20 bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={16} className="text-primary" />
                <span className="text-xs font-medium text-primary">
                  {ar ? `السؤال ${interview.currentQuestionIndex + 1}` : `Question ${interview.currentQuestionIndex + 1}`}
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {currentQ?.category === "professional" ? (ar ? "مهني" : "Professional") : (ar ? "عام" : "HR")}
                </Badge>
              </div>
              <p className="text-foreground font-medium font-body">{currentQ?.question}</p>
            </div>

            {/* Transcript */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Mic size={16} className="text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {ar ? "إجابتك" : "Your Answer"}
                </span>
                {speech.isListening && (
                  <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
                )}
              </div>

              {speech.isSupported && !speech.isListening ? (
                <>
                  <div className="min-h-[60px] text-sm text-foreground font-body">
                    {speech.transcript || (
                      <span className="text-muted-foreground italic">
                        {ar ? "اضغط \"ابدأ الإجابة\" ثم تحدث، أو اكتب أدناه..." : 'Click "Start Answer" then speak, or type below...'}
                      </span>
                    )}
                  </div>
                  {/* Always show text input as fallback */}
                  <Textarea
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder={ar ? "أو اكتب إجابتك هنا..." : "Or type your answer here..."}
                    className="min-h-[60px] text-sm mt-2 border-dashed"
                  />
                </>
              ) : speech.isListening ? (
                <div className="min-h-[60px] text-sm text-foreground font-body">
                  {speech.transcript || (
                    <span className="text-muted-foreground italic animate-pulse">
                      {ar ? "جارٍ الاستماع..." : "Listening..."}
                    </span>
                  )}
                </div>
              ) : (
                <Textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder={ar ? "اكتب إجابتك هنا..." : "Type your answer here..."}
                  className="min-h-[80px] text-sm"
                />
              )}
            </div>

            {/* Evaluation */}
            <AnimatePresence>
              {currentEvaluation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-border bg-card p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{ar ? "التقييم" : "Evaluation"}</span>
                    <Badge className={`${currentEvaluation.score >= 7 ? "bg-success" : currentEvaluation.score >= 5 ? "bg-primary" : "bg-destructive"} text-white`}>
                      {currentEvaluation.score}/10
                    </Badge>
                  </div>

                  {/* Strengths */}
                  <div>
                    <p className="text-xs font-semibold text-success mb-1">{ar ? "نقاط القوة" : "Strengths"}</p>
                    <ul className="space-y-1">
                      {currentEvaluation.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                          <CheckCircle2 size={12} className="text-success shrink-0 mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Improvements */}
                  <div>
                    <p className="text-xs font-semibold text-amber-600 mb-1">{ar ? "للتحسين" : "Improvements"}</p>
                    <ul className="space-y-1">
                      {currentEvaluation.improvements.map((s, i) => (
                        <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                          <TrendingUp size={12} className="text-amber-500 shrink-0 mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Ideal answer */}
                  <div className="rounded-lg bg-primary/5 p-3">
                    <p className="text-xs font-semibold text-primary mb-1">{ar ? "الإجابة المثالية" : "Ideal Answer"}</p>
                    <p className="text-xs text-foreground font-body">{currentEvaluation.ideal_answer}</p>
                  </div>

                  <p className="text-xs text-muted-foreground italic">{currentEvaluation.confidence_assessment}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={speakCurrentQuestion} disabled={tts.isSpeaking} className="gap-1.5">
                <RotateCcw size={14} />
                {ar ? "أعد السؤال" : "Repeat"}
              </Button>

              {speech.isListening && (
                <Button size="sm" variant="destructive" onClick={handleStopAnswer} className="gap-1.5">
                  <Square size={14} />
                  {ar ? "أوقف وأرسل" : "Stop & Submit"}
                </Button>
              )}

              {!speech.isListening && !currentEvaluation && (
                <>
                  {speech.isSupported && (
                    <Button size="sm" onClick={handleStartAnswer} disabled={tts.isSpeaking || interview.isEvaluating} className="gap-1.5">
                      <Mic size={14} />
                      {ar ? "ابدأ الإجابة صوتياً" : "Voice Answer"}
                    </Button>
                  )}
                  {/* Always show text submit button when there's manual input */}
                  <Button
                    size="sm"
                    variant={speech.isSupported ? "outline" : "default"}
                    onClick={handleStopAnswer}
                    disabled={(!manualInput.trim() && !speech.transcript.trim()) || interview.isEvaluating}
                    className="gap-1.5"
                  >
                    {interview.isEvaluating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {ar ? "إرسال الإجابة" : "Submit Answer"}
                  </Button>
                </>
              )}

              {currentEvaluation && (
                <>
                  {!isLastQuestion ? (
                    <Button size="sm" onClick={handleNextQuestion} className="gap-1.5">
                      <SkipForward size={14} />
                      {ar ? "السؤال التالي" : "Next Question"}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handleEndInterview} className="gap-1.5">
                      <CheckCircle2 size={14} />
                      {ar ? "إنهاء المقابلة" : "End Interview"}
                    </Button>
                  )}
                </>
              )}

              <Button variant="ghost" size="sm" onClick={handleEndInterview} className="gap-1.5 text-muted-foreground ms-auto">
                {ar ? "إنهاء" : "End"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InterviewAvatar;
