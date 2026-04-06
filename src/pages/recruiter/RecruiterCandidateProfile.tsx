/**
 * TALENTRY — RecruiterCandidateProfile.tsx  (UPDATED)
 *
 * Full candidate journey profile with:
 *  - NextStepCard (NO DEAD ENDS)
 *  - JourneyProgressBar
 *  - AI Analysis tab with ATS score
 *  - Matched Jobs tab
 *  - Interview History tab (sessions + results)
 *  - Notes tab
 *  - All 4 primary action buttons (Shortlist / AI Interview / Match / Send Link)
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft,
  Brain,
  FileText,
  MessageSquareText,
  StickyNote,
  Loader2,
  Send,
  Star,
  AlertTriangle,
  CheckCircle2,
  User,
  Briefcase,
  ShieldAlert,
  CircleHelp,
  ArrowRightLeft,
  Target,
  Sparkles,
  Video,
  Clock,
  TrendingUp,
} from "lucide-react";
import {
  useCandidateJobMatches,
  triggerMatchCalculation,
  matchScoreColor,
  matchScoreBg,
  matchScoreLabel,
} from "@/hooks/useJobMatches";
import { NextStepCard, CandidateStatusBadge, JourneyProgressBar } from "@/components/recruiter/NextStepCard";
import { StartInterviewButton } from "@/components/recruiter/StartInterviewButton";
import { useCandidateInterviewSessions } from "@/hooks/useInterviewJourney";
import {
  generateAndPersistCandidateAnalysis,
  loadCandidateAnalysisHistory,
  type CandidateAnalysisHistoryItem,
} from "@/hooks/useCandidateAnalysis";

// ─── Stages ───────────────────────────────────────────────────────────────────
const STAGES = [
  "new",
  "under_review",
  "shortlisted",
  "interview_scheduled",
  "ai_interview_sent",
  "ai_interview_completed",
  "live_interview_scheduled",
  "rejected",
  "hired",
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface CandidateData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  current_title: string | null;
  experience_years: number | null;
  stage: string;
  fit_score: number | null;
  fit_label: string | null;
  ats_score: number | null;
  file_name: string | null;
  file_path: string | null;
  extracted_text: string | null;
  structured_data: any;
  ai_report: any;
  latest_analysis_html: string | null;
  latest_analysis_json: any;
  latest_analysis_score: number | null;
  latest_analysis_at: string | null;
  latest_analysis_version: string | null;
  interview_score: number | null;
  interview_recommendation: string | null;
  interview_results: any;
  created_at: string;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MatchedJobsSection({
  candidateId,
  ar,
  navigate,
}: {
  candidateId: string | undefined;
  ar: boolean;
  navigate: (p: string) => void;
}) {
  const { matches, loading, load } = useCandidateJobMatches(candidateId);
  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {ar ? "جاري تحميل الوظائف المطابقة..." : "Loading matched jobs…"}
        </div>
      </Card>
    );

  if (!matches.length)
    return (
      <Card className="p-6 text-center">
        <Target size={28} className="text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{ar ? "لا توجد وظائف مطابقة بعد" : "No job matches yet"}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/recruiter/jobs")}>
          {ar ? "إضافة وظائف" : "Add Jobs"}
        </Button>
      </Card>
    );

  return (
    <div className="space-y-2">
      {matches.map((m) => (
        <Card key={m.id} className="p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Briefcase size={14} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{m.job_title || "—"}</p>
            <p className="text-xs text-muted-foreground truncate">{m.job_department || "—"}</p>
            {m.match_reasons?.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{m.match_reasons[0]}</p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <div className={`text-lg font-bold leading-none ${matchScoreColor(m.match_score)}`}>{m.match_score}%</div>
            <div className={`text-[10px] mt-0.5 ${matchScoreBg(m.match_score)} rounded px-1.5 py-0.5 inline-block`}>
              {matchScoreLabel(m.match_score, ar)}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function InterviewSessionsSection({
  candidateId,
  candidate,
  ar,
  navigate,
}: {
  candidateId: string | undefined;
  candidate: CandidateData;
  ar: boolean;
  navigate: (p: string) => void;
}) {
  const { sessions, load, loading } = useCandidateInterviewSessions(candidateId);
  useEffect(() => {
    load();
  }, [load]);

  const recColor = (rec: string | null) => {
    if (!rec) return "text-muted-foreground";
    if (rec === "Strong Hire" || rec === "Hire") return "text-green-600 font-semibold";
    if (rec === "Reject") return "text-red-500 font-semibold";
    return "text-amber-600 font-semibold";
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> {ar ? "جاري التحميل..." : "Loading..."}
      </div>
    );

  if (!sessions.length)
    return (
      <Card className="p-6 text-center">
        <Brain size={28} className="text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-3">
          {ar ? "لا توجد جلسات مقابلة بعد" : "No interview sessions yet"}
        </p>
        <StartInterviewButton
          candidateId={candidate.id}
          candidateName={candidate.name}
          candidateEmail={candidate.email}
          extractedText={candidate.extracted_text}
          currentTitle={candidate.current_title}
        />
      </Card>
    );

  return (
    <div className="space-y-3">
      {sessions.map((sess) => (
        <Card key={sess.id} className="p-4 hover:border-primary/30 transition-colors">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge
                  className={
                    sess.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : sess.status === "in_progress"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-muted text-muted-foreground"
                  }
                >
                  {sess.status}
                </Badge>
                {sess.overall_score != null && (
                  <span className="text-base font-bold text-primary">{sess.overall_score}/100</span>
                )}
                {sess.recommendation && (
                  <span className={`text-sm ${recColor(sess.recommendation)}`}>{sess.recommendation}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock size={11} />
                {new Date(sess.created_at).toLocaleString()}
              </p>
              {sess.evaluation_summary && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                  {sess.evaluation_summary}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {sess.status === "completed" ? (
                <Button size="sm" variant="outline" onClick={() => navigate(`/recruiter/interview/${sess.id}/results`)}>
                  <TrendingUp size={13} className="mr-1.5" />
                  {ar ? "عرض النتائج" : "View Results"}
                </Button>
              ) : (
                <Button size="sm" onClick={() => navigate(`/recruiter/interview/${sess.id}`)}>
                  <Brain size={13} className="mr-1.5" />
                  {ar ? "متابعة المقابلة" : "Continue Interview"}
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
      <div className="pt-1">
        <StartInterviewButton
          candidateId={candidate.id}
          candidateName={candidate.name}
          candidateEmail={candidate.email}
          extractedText={candidate.extracted_text}
          currentTitle={candidate.current_title}
          variant="outline"
        />
      </div>
    </div>
  );
}

// ─── Score helpers ─────────────────────────────────────────────────────────────
function getFitColor(score: number | null | undefined) {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-yellow-600";
  return "text-destructive";
}
function getDecisionColor(decision?: string) {
  const v = String(decision || "").toLowerCase();
  if (v.includes("strong") || v.includes("hire")) return "text-green-600";
  if (v.includes("reject") || v.includes("weak")) return "text-destructive";
  return "text-foreground";
}
function getExperienceLabel(years: number | null | undefined, ar: boolean) {
  if (years == null) return ar ? "غير محدد" : "Not specified";
  if (years < 2) return "Junior";
  if (years < 6) return "Mid-Level";
  return "Senior";
}
function normalizeStringArray(input: any): string[] {
  if (Array.isArray(input)) return input.map((i) => String(i || "").trim()).filter(Boolean);
  if (typeof input === "string" && input.trim())
    return input
      .split(/\n|•|- /)
      .map((i) => i.trim())
      .filter(Boolean);
  return [];
}
function normalizeNumber(value: any): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : null;
}
function firstNonEmpty(values: any): string {
  const list = Array.isArray(values) ? values : [values];
  for (const v of list) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
}
function normalizeReport(raw: any) {
  const executive = raw?.executive_hiring_summary || {};
  const scoringTable = raw?.scoring_table || {};
  const hiringRecommendation = raw?.hiring_recommendation || {};
  const strengths = normalizeStringArray(raw?.strengths || raw?.top_strengths);
  const risks = normalizeStringArray(raw?.risks || raw?.concerns || raw?.red_flags);
  const missingRequirements = normalizeStringArray(raw?.missing_requirements || raw?.missing_info);
  const interviewFocusAreas = normalizeStringArray(raw?.interview_focus_areas || raw?.interview_focus);
  return {
    executive: {
      candidateLevel: firstNonEmpty([executive?.candidate_level, raw?.seniority_estimate]),
      bestFitRoles: normalizeStringArray(executive?.best_fit_roles || raw?.role_fit),
      overallFitScore:
        normalizeNumber(executive?.overall_fit_score) ||
        normalizeNumber(scoringTable?.role_match) ||
        normalizeNumber(raw?.score),
    },
    summaryText: firstNonEmpty([executive?.summary, raw?.executive_summary]) || firstNonEmpty(strengths) || "—",
    strengths,
    risks,
    missingRequirements,
    interviewFocusAreas,
    decision: firstNonEmpty([hiringRecommendation?.decision, raw?.recommendation, raw?.fit_label]),
    reasoning: firstNonEmpty([hiringRecommendation?.reasoning]),
    whyThisCandidate: firstNonEmpty([raw?.why_this_candidate, strengths[0]]),
    whyNotThisCandidate: firstNonEmpty([raw?.why_not_this_candidate, risks[0]]),
    scoreItems: [
      { key: "ats", label: "ATS Compatibility", value: normalizeNumber(scoringTable?.ats_compatibility) },
      { key: "role", label: "Role Match", value: normalizeNumber(scoringTable?.role_match) },
      {
        key: "depth",
        label: "Experience Depth",
        value: normalizeNumber(scoringTable?.experience_depth || raw?.experience_quality_score),
      },
      {
        key: "skills",
        label: "Skill Relevance",
        value: normalizeNumber(scoringTable?.skill_relevance || raw?.skills_match_score),
      },
      {
        key: "progress",
        label: "Career Progression",
        value: normalizeNumber(scoringTable?.career_progression || raw?.career_progression_score),
      },
      { key: "stability", label: "Stability", value: normalizeNumber(raw?.stability_score) },
      { key: "education", label: "Education Strength", value: normalizeNumber(raw?.education_strength_score) },
    ],
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
const RecruiterCandidateProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ar = language === "ar";

  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [stageUpdating, setStageUpdating] = useState(false);
  const [latestSessionId, setLatestSessionId] = useState<string | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<CandidateAnalysisHistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<CandidateAnalysisHistoryItem | null>(null);

  const { matches: jobMatches, load: loadJobMatches } = useCandidateJobMatches(id);

  const loadCandidate = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    const { data } = await supabase
      .from("recruiter_candidates")
      .select("*")
      .eq("id", id)
      .eq("recruiter_id", user.id)
      .single();
    setCandidate(data as CandidateData | null);

    const history = await loadCandidateAnalysisHistory(id);
    setAnalysisHistory(history);
    setSelectedHistory((prev) => (prev ? history.find((item) => item.id === prev.id) || null : null));

    const { data: notesData } = await supabase
      .from("recruiter_candidate_notes")
      .select("id, content, created_at")
      .eq("candidate_id", id)
      .eq("recruiter_id", user.id)
      .order("created_at", { ascending: false });
    setNotes((notesData || []) as Note[]);

    // Get latest session ID for NextStepCard
    const { data: sess } = await supabase
      .from("recruiter_interview_sessions")
      .select("id, status")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatestSessionId(sess?.id || null);

    setLoading(false);
  }, [user, id]);

  useEffect(() => {
    loadCandidate();
    loadJobMatches();
  }, [loadCandidate, loadJobMatches]);

  const handleStageChange = async (newStage: string) => {
    if (!candidate) return;
    setStageUpdating(true);
    await supabase.from("recruiter_candidates").update({ stage: newStage }).eq("id", candidate.id);
    setCandidate((prev) => (prev ? { ...prev, stage: newStage } : null));
    setStageUpdating(false);
    toast.success(ar ? "تم تحديث المرحلة" : "Stage updated");
  };

  const handleAddNote = async () => {
    if (!user || !candidate || !newNote.trim()) return;
    setSavingNote(true);
    const { error } = await supabase.from("recruiter_candidate_notes").insert({
      candidate_id: candidate.id,
      recruiter_id: user.id,
      content: newNote.trim(),
    });
    setSavingNote(false);
    if (error) {
      toast.error("Failed");
      return;
    }
    setNewNote("");
    loadCandidate();
  };

  const handleGenerateReport = async () => {
    if (!candidate?.extracted_text || !user) {
      toast.error(ar ? "لا يوجد نص مستخرج من السيرة" : "No extracted text available");
      return;
    }
    setGeneratingReport(true);
    try {
      const analysis = await generateAndPersistCandidateAnalysis({
        candidateId: candidate.id,
        recruiterId: user.id,
        resumeId: candidate.file_path,
        candidateText: candidate.extracted_text,
        candidateName: candidate.name,
        candidateTitle: candidate.current_title,
        language,
        analysisType: candidate.latest_analysis_at ? "manual_refresh" : "manual_create",
      });

      setCandidate((prev) =>
        prev
          ? {
              ...prev,
              ai_report: analysis.report,
              latest_analysis_json: analysis.report,
              latest_analysis_html: analysis.html,
              latest_analysis_score: analysis.score,
              latest_analysis_at: new Date().toISOString(),
              latest_analysis_version: analysis.version,
            }
          : null,
      );
      await loadCandidate();
      toast.success(ar ? "تم حفظ التحليل" : "Analysis saved");
      triggerMatchCalculation({ candidate_id: candidate.id });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report");
    } finally {
      setGeneratingReport(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  if (!candidate)
    return (
      <div className="p-6 text-center text-muted-foreground">{ar ? "المرشح غير موجود" : "Candidate not found"}</div>
    );

  const activeAnalysisJson = selectedHistory?.analysis_json || candidate.latest_analysis_json || candidate.ai_report;
  const report = normalizeReport(activeAnalysisJson);
  const bestJobMatchScore = jobMatches.length ? jobMatches[0].match_score : null;
  const atsScore =
    selectedHistory?.score ??
    candidate.latest_analysis_score ??
    candidate.ats_score ??
    report.scoreItems.find((s) => s.key === "ats")?.value ??
    null;
  const displayedFitScore = bestJobMatchScore ?? candidate.fit_score ?? null;
  const hasInterviewSession = !!latestSessionId;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/recruiter/candidates")}>
        <ArrowLeft size={14} className="mr-1" /> {ar ? "العودة" : "Back"}
      </Button>

      {/* ── Next Step Card (NO DEAD END) ────────────────────────────────────── */}
      <NextStepCard
        candidateId={candidate.id}
        candidateName={candidate.name}
        candidateEmail={candidate.email}
        stage={candidate.stage as any}
        hasExtractedText={!!candidate.extracted_text}
        hasAiReport={!!(candidate.latest_analysis_json || candidate.ai_report)}
        hasMatchedJobs={jobMatches.length > 0}
        hasInterviewSession={hasInterviewSession}
        interviewSessionId={latestSessionId}
        ar={ar}
        onShortlist={() => handleStageChange("shortlisted")}
        onStartAnalysis={handleGenerateReport}
      />

      {/* ── Profile Header Card ──────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{candidate.name}</h1>
              <p className="text-sm text-muted-foreground">{candidate.current_title || "—"}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {candidate.email ? <Badge variant="outline">{candidate.email}</Badge> : null}
                {candidate.phone ? <Badge variant="outline">{candidate.phone}</Badge> : null}
                <Badge variant="secondary">{getExperienceLabel(candidate.experience_years, ar)}</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* ATS Score pill */}
            {atsScore != null && (
              <div className="rounded-lg border border-border px-3 py-2 text-center min-w-[90px]">
                <div className="text-[10px] text-muted-foreground">ATS Score</div>
                <div className={`text-lg font-bold mt-0.5 ${getFitColor(atsScore)}`}>{atsScore}%</div>
              </div>
            )}
            {/* Fit Score pill */}
            {displayedFitScore != null && (
              <div className="rounded-lg border border-border px-3 py-2 text-center min-w-[90px]">
                <div className="text-[10px] text-muted-foreground">
                  {bestJobMatchScore != null ? "Best Job Match" : "Overall Fit"}
                </div>
                <div className={`text-lg font-bold mt-0.5 ${getFitColor(displayedFitScore)}`}>{displayedFitScore}%</div>
              </div>
            )}
            {/* Interview Score pill */}
            {candidate.interview_score != null && (
              <div className="rounded-lg border border-border px-3 py-2 text-center min-w-[90px]">
                <div className="text-[10px] text-muted-foreground">Interview</div>
                <div className={`text-lg font-bold mt-0.5 ${getFitColor(candidate.interview_score)}`}>
                  {candidate.interview_score}%
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <CandidateStatusBadge stage={candidate.stage} />
              <JourneyProgressBar stage={candidate.stage} ar={ar} />
            </div>
            <Select value={candidate.stage} onValueChange={handleStageChange} disabled={stageUpdating}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Primary Action Buttons ───────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
          <Button size="sm" onClick={handleGenerateReport} disabled={generatingReport}>
            {generatingReport ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Brain size={14} className="mr-1.5" />
            )}
            {ar ? "تحديث تحليل AI" : "Refresh AI Analysis"}
          </Button>

          {/* SHORTLIST */}
          <Button size="sm" variant="secondary" onClick={() => handleStageChange("shortlisted")}>
            <Star size={14} className="mr-1.5" /> {ar ? "اختيار" : "Shortlist"}
          </Button>

          {/* START AI INTERVIEW */}
          <StartInterviewButton
            candidateId={candidate.id}
            candidateName={candidate.name}
            candidateEmail={candidate.email}
            extractedText={candidate.extracted_text}
            currentTitle={candidate.current_title}
            size="sm"
          />

          {/* SEND INTERVIEW LINK */}
          <StartInterviewButton
            candidateId={candidate.id}
            candidateName={candidate.name}
            candidateEmail={candidate.email}
            extractedText={candidate.extracted_text}
            currentTitle={candidate.current_title}
            mode="send"
            size="sm"
            variant="outline"
          />

          {/* MATCH TO JOBS */}
          <Button size="sm" variant="outline" onClick={() => navigate("/recruiter/jobs")}>
            <Target size={14} className="mr-1.5" /> {ar ? "مطابقة بوظيفة" : "Match to Jobs"}
          </Button>

          <Button size="sm" variant="destructive" onClick={() => handleStageChange("rejected")}>
            <AlertTriangle size={14} className="mr-1.5" /> {ar ? "رفض" : "Reject"}
          </Button>
        </div>
      </Card>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="report">
        <TabsList className="w-full justify-start flex-wrap h-auto">
          <TabsTrigger value="report">
            <Brain size={14} className="mr-1.5" /> {ar ? "التحليل AI" : "AI Analysis"}
          </TabsTrigger>
          <TabsTrigger value="jobs">
            <Target size={14} className="mr-1.5" /> {ar ? "الوظائف" : "Job Matches"}
          </TabsTrigger>
          <TabsTrigger value="interviews">
            <Video size={14} className="mr-1.5" /> {ar ? "المقابلات" : "Interviews"}
          </TabsTrigger>
          <TabsTrigger value="resume">
            <FileText size={14} className="mr-1.5" /> {ar ? "السيرة" : "Resume"}
          </TabsTrigger>
          <TabsTrigger value="notes">
            <StickyNote size={14} className="mr-1.5" /> {ar ? "ملاحظات" : "Notes"}
          </TabsTrigger>
        </TabsList>

        {/* ── AI Analysis Tab ──────────────────────────────────────────────── */}
        <TabsContent value="report" className="mt-4 space-y-4">
          {!(candidate.latest_analysis_json || candidate.ai_report) ? (
            <Card className="p-8 text-center">
              <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                {ar ? "لا يوجد تحليل محفوظ بعد" : "No saved AI analysis yet"}
              </p>
              <Button size="sm" onClick={handleGenerateReport} disabled={generatingReport || !candidate.extracted_text}>
                {generatingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                {ar ? "إنشاء التقرير الآن" : "Create Report Now"}
              </Button>
            </Card>
          ) : (
            <>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {ar ? "التحليل الحالي" : "Saved Analysis"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {candidate.latest_analysis_at
                        ? new Date(candidate.latest_analysis_at).toLocaleString()
                        : ar
                          ? "تحليل قديم متوافق"
                          : "Legacy analysis"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleGenerateReport}
                    disabled={generatingReport || !candidate.extracted_text}
                  >
                    {generatingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    {ar ? "تحديث تحليل AI" : "Refresh AI Analysis"}
                  </Button>
                </div>
                {!!analysisHistory.length && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground">
                      {ar ? "التحليلات السابقة" : "Previous Analyses"}
                    </h4>
                    {analysisHistory.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div>
                          <div className="text-sm font-medium">{new Date(item.created_at).toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {ar ? "النتيجة" : "Score"}: {item.score ?? "—"} · {item.analysis_type || "manual"}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={selectedHistory?.id === item.id ? "default" : "outline"}
                          onClick={() => setSelectedHistory(item)}
                        >
                          {ar ? "فتح" : "Open"}
                        </Button>
                      </div>
                    ))}
                    {!!selectedHistory && (
                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedHistory(null)}>
                          {ar ? "العودة لأحدث نسخة" : "Back to Latest"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* ATS Score breakdown */}
              {atsScore != null && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={14} className="text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">ATS Score Breakdown</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {report.scoreItems.map(
                      (item) =>
                        item.value != null && (
                          <div key={item.key} className="space-y-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-foreground font-medium">{item.label}</span>
                              <span className={getFitColor(item.value)}>{item.value}</span>
                            </div>
                            <Progress value={item.value} />
                          </div>
                        ),
                    )}
                  </div>
                </Card>
              )}

              {/* Summary + Decision */}
              <div className="grid xl:grid-cols-3 gap-4">
                <Card className="p-4 xl:col-span-2">
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    {ar ? "الملخص التنفيذي" : "Executive Hiring Summary"}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-7">{report.summaryText}</p>
                </Card>
                <Card className="p-4 space-y-3">
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1">Recommended Role(s)</div>
                    <div className="text-sm font-medium">{report.executive.bestFitRoles.join(", ") || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1">Hiring Decision</div>
                    <div className={`text-sm font-medium ${getDecisionColor(report.decision)}`}>
                      {report.decision || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1">Reasoning</div>
                    <div className="text-sm text-muted-foreground">{report.reasoning || "—"}</div>
                  </div>
                </Card>
              </div>

              {/* Lists */}
              <div className="grid xl:grid-cols-2 gap-4">
                {[
                  {
                    title: ar ? "نقاط القوة" : "Strengths",
                    icon: CheckCircle2,
                    cls: "text-green-500",
                    items: report.strengths,
                    empty: "No strengths identified",
                  },
                  {
                    title: ar ? "المخاطر" : "Risks",
                    icon: ShieldAlert,
                    cls: "text-destructive",
                    items: report.risks,
                    empty: "No major risk flags",
                  },
                  {
                    title: ar ? "متطلبات ناقصة" : "Missing Requirements",
                    icon: AlertTriangle,
                    cls: "text-yellow-600",
                    items: report.missingRequirements,
                    empty: "None identified",
                  },
                  {
                    title: ar ? "محاور المقابلة" : "Interview Focus Areas",
                    icon: CircleHelp,
                    cls: "text-primary",
                    items: report.interviewFocusAreas,
                    empty: "None",
                  },
                ].map(({ title, icon: Icon, cls, items, empty }) => (
                  <Card key={title} className="p-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-3">
                      <Icon size={14} className={cls} /> {title}
                    </h3>
                    {items.length ? (
                      <ul className="space-y-2">
                        {items.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2 leading-7">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">{empty}</p>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Job Matches Tab ──────────────────────────────────────────────── */}
        <TabsContent value="jobs" className="mt-4">
          <MatchedJobsSection candidateId={id} ar={ar} navigate={navigate} />
        </TabsContent>

        {/* ── Interview History Tab ────────────────────────────────────────── */}
        <TabsContent value="interviews" className="mt-4">
          <InterviewSessionsSection candidateId={id} candidate={candidate} ar={ar} navigate={navigate} />
        </TabsContent>

        {/* ── Resume Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="resume" className="mt-4">
          <Card className="p-4">
            {candidate.file_name && (
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                <FileText size={14} className="text-primary" />
                <span className="text-sm font-medium">{candidate.file_name}</span>
              </div>
            )}
            {candidate.extracted_text ? (
              <pre className="text-sm text-muted-foreground font-body whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
                {candidate.extracted_text}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {ar ? "لا يوجد نص مستخرج" : "No extracted text available"}
              </p>
            )}
          </Card>
        </TabsContent>

        {/* ── Notes Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="notes" className="mt-4 space-y-3">
          <Card className="p-4">
            <div className="flex gap-2">
              <Textarea
                placeholder={ar ? "أضف ملاحظة..." : "Add a note..."}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="bg-card"
                rows={2}
              />
              <Button size="sm" onClick={handleAddNote} disabled={savingNote || !newNote.trim()} className="self-end">
                {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StickyNote size={14} />}
              </Button>
            </div>
          </Card>
          {notes.map((n) => (
            <Card key={n.id} className="p-3">
              <p className="text-sm text-foreground">{n.content}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </Card>
          ))}
          {!notes.length && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {ar ? "لا توجد ملاحظات بعد" : "No notes yet"}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RecruiterCandidateProfile;


