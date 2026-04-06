import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountType } from "@/contexts/AccountTypeContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserPlus,
  Briefcase,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Sparkles,
  Clock,
  TrendingUp,
  Upload,
  ArrowRight,
  CircleDot,
  Target,
} from "lucide-react";
import {
  useRecruiterTopMatches,
  matchScoreColor,
  matchScoreBg,
  matchScoreLabel,
  matchBarColor,
  type JobMatch,
} from "@/hooks/useJobMatches";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  title: string;
  department: string | null;
  status: string;
  created_at: string;
}

interface Candidate {
  id: string;
  name: string;
  current_title: string | null;
  stage: string;
  fit_score: number | null;
  fit_label: string | null;
  experience_years: number | null;
  job_id: string | null;
  created_at: string;
  best_job_title?: string | null;
  best_job_score?: number | null;
}

interface JobWithCandidates extends Job {
  candidates: Candidate[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fitColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600";
  if (score >= 65) return "text-blue-600";
  if (score >= 45) return "text-amber-600";
  return "text-red-500";
}

function fitBg(score: number | null): string {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 65) return "bg-blue-100 text-blue-700";
  if (score >= 45) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function stageBadge(stage: string): string {
  const map: Record<string, string> = {
    new: "bg-slate-100 text-slate-600",
    under_review: "bg-yellow-100 text-yellow-700",
    shortlisted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    hired: "bg-emerald-100 text-emerald-700",
    ai_interview_sent: "bg-indigo-100 text-indigo-700",
    ai_interview_completed: "bg-violet-100 text-violet-700",
    live_interview_scheduled: "bg-orange-100 text-orange-700",
  };
  return map[stage] ?? "bg-muted text-muted-foreground";
}

function stageLabel(stage: string, ar: boolean): string {
  const map: Record<string, [string, string]> = {
    new: ["جديد", "New"],
    under_review: ["قيد المراجعة", "In Review"],
    shortlisted: ["مختصر", "Shortlisted"],
    rejected: ["مرفوض", "Rejected"],
    hired: ["تم التعيين", "Hired"],
    ai_interview_sent: ["مقابلة AI أُرسلت", "AI Interview Sent"],
    ai_interview_completed: ["مقابلة AI مكتملة", "AI Interview Done"],
    live_interview_scheduled: ["مقابلة حضورية", "Live Scheduled"],
  };
  const pair = map[stage];
  if (!pair) return stage.replace(/_/g, " ");
  return ar ? pair[0] : pair[1];
}

async function updateStage(candidateId: string, stage: string) {
  await supabase.from("recruiter_candidates").update({ stage }).eq("id", candidateId);
  window.location.reload();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-foreground font-medium mt-1 truncate">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </Card>
  );
}

function CandidateCard({
  candidate,
  ar,
  navigate,
  onStageChange,
}: {
  candidate: Candidate;
  ar: boolean;
  navigate: (path: string) => void;
  onStageChange: () => void;
}) {
  const [acting, setActing] = useState(false);

  const act = async (stage: string) => {
    setActing(true);
    await updateStage(candidate.id, stage);
    onStageChange();
    setActing(false);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
          {candidate.name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")
            .toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <button
                onClick={() => navigate(`/recruiter/candidates/${candidate.id}`)}
                className="text-sm font-semibold text-foreground hover:text-primary text-start leading-tight"
              >
                {candidate.name}
              </button>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{candidate.current_title || "—"}</p>
            </div>
            {/* Score */}
            <div className="shrink-0 text-end">
              <span className={`text-lg font-bold leading-none ${fitColor(candidate.fit_score)}`}>
                {candidate.fit_score != null ? `${candidate.fit_score}%` : "—"}
              </span>
              <p className="text-[10px] text-muted-foreground">match</p>
            </div>
          </div>

          {/* Score bar */}
          {candidate.fit_score != null && (
            <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${candidate.fit_score}%` }}
              />
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${stageBadge(candidate.stage)}`}>
              {stageLabel(candidate.stage, ar)}
            </span>
            {candidate.fit_label && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${fitBg(candidate.fit_score)}`}>
                {candidate.fit_label}
              </span>
            )}
          </div>

          {/* Actions */}
          {candidate.stage !== "shortlisted" && candidate.stage !== "rejected" && candidate.stage !== "hired" && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <Button
                size="sm"
                className="h-6 text-[11px] px-2.5 bg-green-600 hover:bg-green-700"
                disabled={acting}
                onClick={() => act("shortlisted")}
              >
                <CheckCircle2 size={10} className="mr-1" />
                {ar ? "اختصر" : "Shortlist"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] px-2.5"
                disabled={acting}
                onClick={() => navigate(`/recruiter/candidates/${candidate.id}`)}
              >
                {ar ? "عرض الملف" : "View"}
                <ArrowRight size={10} className="ml-1" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] px-2 text-destructive hover:text-destructive"
                disabled={acting}
                onClick={() => act("rejected")}
              >
                <XCircle size={10} className="mr-1" />
                {ar ? "رفض" : "Reject"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JobPanel({ job, ar, navigate }: { job: JobWithCandidates; ar: boolean; navigate: (path: string) => void }) {
  const [expanded, setExpanded] = useState(true);

  const total = job.candidates.length;
  const shortlisted = job.candidates.filter((c) => c.stage === "shortlisted").length;
  const pending = job.candidates.filter((c) => !["shortlisted", "rejected", "hired"].includes(c.stage)).length;
  const topCandidates = [...job.candidates].sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0)).slice(0, 5);

  return (
    <Card className="overflow-hidden">
      {/* Job header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-start"
      >
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Briefcase size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{job.title}</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                job.status === "open" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
              }`}
            >
              {ar ? (job.status === "open" ? "مفتوح" : "مغلق") : job.status}
            </span>
          </div>
          {job.department && <p className="text-xs text-muted-foreground mt-0.5">{job.department}</p>}
        </div>
        {/* Quick stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center hidden sm:block">
            <p className="text-base font-bold text-foreground leading-none">{total}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{ar ? "مرشح" : "total"}</p>
          </div>
          <div className="text-center hidden sm:block">
            <p className="text-base font-bold text-green-600 leading-none">{shortlisted}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{ar ? "مختصر" : "shortlist"}</p>
          </div>
          <div className="text-center hidden sm:block">
            <p className="text-base font-bold text-amber-500 leading-none">{pending}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{ar ? "معلق" : "pending"}</p>
          </div>
          <ChevronRight
            size={16}
            className={`text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </button>

      {/* Candidates */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/10">
          {total === 0 ? (
            <div className="py-6 text-center">
              <Users size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {ar ? "لا يوجد مرشحون لهذه الوظيفة بعد" : "No candidates yet for this job"}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => navigate("/recruiter/candidates?action=upload")}
              >
                <Upload size={12} className="mr-1.5" />
                {ar ? "رفع سيرة ذاتية" : "Upload CV"}
              </Button>
            </div>
          ) : (
            <>
              {/* Fit score overview bar */}
              <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                <Sparkles size={12} className="text-primary" />
                <span>
                  {ar
                    ? `${topCandidates.filter((c) => (c.fit_score ?? 0) >= 70).length} من ${total} مرشح بتوافق عالٍ`
                    : `${topCandidates.filter((c) => (c.fit_score ?? 0) >= 70).length} of ${total} candidates with high fit`}
                </span>
                <button
                  onClick={() => navigate(`/recruiter/candidates`)}
                  className="mr-auto text-primary hover:underline flex items-center gap-0.5"
                >
                  {ar ? "عرض الكل" : "View all"}
                  <ChevronRight size={11} />
                </button>
              </div>

              <div className="space-y-2">
                {topCandidates.map((c) => (
                  <CandidateCard key={c.id} candidate={c} ar={ar} navigate={navigate} onStageChange={() => {}} />
                ))}
              </div>

              {total > 5 && (
                <button
                  onClick={() => navigate("/recruiter/candidates")}
                  className="mt-3 w-full text-xs text-primary hover:underline flex items-center justify-center gap-1 py-1"
                >
                  {ar ? `+ ${total - 5} مرشح آخر` : `+ ${total - 5} more candidates`}
                  <ArrowRight size={11} />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const RecruiterDashboard = () => {
  const { user } = useAuth();
  const { companyName } = useAccountType();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ar = language === "ar";

  const [jobs, setJobs] = useState<JobWithCandidates[]>([]);
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const { matches: topMatches, loading: matchesLoading, load: loadMatches } = useRecruiterTopMatches(user?.id);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: jobsData }, { data: candidatesData }, { data: matchesData }] = await Promise.all([
        supabase
          .from("recruiter_jobs")
          .select("id, title, department, status, created_at")
          .eq("recruiter_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("recruiter_candidates")
          .select("id, name, current_title, stage, fit_score, fit_label, experience_years, job_id, created_at")
          .eq("recruiter_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500),
        (supabase as any)
          .from("recruiter_candidate_job_matches")
          .select("candidate_id, job_id, match_score, recruiter_jobs!inner(title)")
          .eq("recruiter_id", user.id)
          .order("match_score", { ascending: false }),
      ]);

      const rawCandidates = (candidatesData || []) as Candidate[];
      const matchRows = (matchesData || []) as any[];
      const bestMatchByCandidate = new Map<string, { job_id: string; title: string | null; score: number }>();
      const candidatesByJob = new Map<string, Candidate[]>();

      for (const row of matchRows) {
        const existing = bestMatchByCandidate.get(row.candidate_id);
        if (!existing || Number(row.match_score || 0) > existing.score) {
          bestMatchByCandidate.set(row.candidate_id, {
            job_id: row.job_id,
            title: row.recruiter_jobs?.title || null,
            score: Number(row.match_score || 0),
          });
        }
      }

      const mergedCandidates = rawCandidates.map((candidate) => {
        const best = bestMatchByCandidate.get(candidate.id);
        return {
          ...candidate,
          fit_score: best?.score ?? candidate.fit_score,
          job_id: best?.job_id ?? candidate.job_id,
          best_job_title: best?.title ?? null,
          best_job_score: best?.score ?? null,
        };
      });

      for (const candidate of mergedCandidates) {
        if (!candidate.job_id) continue;
        const list = candidatesByJob.get(candidate.job_id) || [];
        list.push(candidate);
        candidatesByJob.set(candidate.job_id, list);
      }

      const sortedCandidates = [...mergedCandidates].sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));
      setAllCandidates(sortedCandidates);

      const jobList = (jobsData || []) as Job[];
      const withCandidates: JobWithCandidates[] = jobList.map((job) => ({
        ...job,
        candidates: (candidatesByJob.get(job.id) || []).sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0)),
      }));

      const unassigned = mergedCandidates.filter((c) => !c.job_id);
      if (unassigned.length > 0) {
        withCandidates.push({
          id: "__unassigned__",
          title: ar ? "مرشحون غير مرتبطون بوظيفة" : "Unassigned Candidates",
          department: null,
          status: "open",
          created_at: "",
          candidates: unassigned,
        });
      }

      setJobs(withCandidates);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, ar]);

  useEffect(() => {
    load();
    loadMatches();
  }, [load, loadMatches]);

  // Aggregate stats
  const totalJobs = jobs.filter((j) => j.id !== "__unassigned__").length;
  const openJobs = jobs.filter((j) => j.id !== "__unassigned__" && j.status === "open").length;
  const totalCandidates = allCandidates.length;
  const shortlisted = allCandidates.filter((c) => c.stage === "shortlisted").length;
  const pendingDecision = allCandidates.filter((c) => !["shortlisted", "rejected", "hired"].includes(c.stage)).length;
  const topFit = allCandidates.filter((c) => (c.fit_score ?? 0) >= 80).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {ar
              ? `مرحباً${companyName ? `، ${companyName}` : ""}`
              : `Welcome back${companyName ? `, ${companyName}` : ""}`}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ar ? "لوحة قرارات التوظيف" : "Hiring decision workspace"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate("/recruiter/candidates?action=upload")}>
            <Upload size={13} className="mr-1.5" />
            {ar ? "رفع سيرة ذاتية" : "Upload CV"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/recruiter/jobs")}>
            <Briefcase size={13} className="mr-1.5" />
            {ar ? "إدارة الوظائف" : "Manage Jobs"}
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={Briefcase}
          label={ar ? "وظائف مفتوحة" : "Open Jobs"}
          value={openJobs}
          sub={ar ? `من ${totalJobs} إجمالاً` : `of ${totalJobs} total`}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          icon={Users}
          label={ar ? "إجمالي المرشحين" : "Total Candidates"}
          value={totalCandidates}
          color="bg-slate-100 text-slate-600"
        />
        <StatCard
          icon={TrendingUp}
          label={ar ? "توافق عالٍ ≥80%" : "High Fit ≥80%"}
          value={topFit}
          sub={ar ? "موصى بمقابلتهم" : "Recommended"}
          color="bg-green-100 text-green-600"
        />
        <StatCard
          icon={CheckCircle2}
          label={ar ? "في القائمة المختصرة" : "Shortlisted"}
          value={shortlisted}
          color="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          icon={Clock}
          label={ar ? "بانتظار القرار" : "Pending Decision"}
          value={pendingDecision}
          sub={ar ? "لم يُبَت بها بعد" : "No decision yet"}
          color="bg-amber-100 text-amber-600"
        />
        <StatCard
          icon={CircleDot}
          label={ar ? "نسبة الاختصار" : "Shortlist Rate"}
          value={totalCandidates ? `${Math.round((shortlisted / totalCandidates) * 100)}%` : "—"}
          color="bg-violet-100 text-violet-600"
        />
      </div>

      {/* Top Matches Widget */}
      {topMatches.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                {ar ? "أعلى التوافقات" : "Top Matches"}
              </h2>
              <Badge variant="secondary" className="text-[10px]">{topMatches.length}</Badge>
            </div>
            <button
              onClick={() => navigate("/recruiter/jobs")}
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              {ar ? "عرض الكل" : "View all"} <ChevronRight size={11} />
            </button>
          </div>
          <div className="space-y-2">
            {topMatches.slice(0, 5).map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/recruiter/candidates/${m.candidate_id}`)}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                  {(m.candidate_name || "?").split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.candidate_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.job_title} {m.job_department ? `· ${m.job_department}` : ""}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <div className="hidden sm:block w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${matchBarColor(m.match_score)} transition-all duration-700`}
                      style={{ width: `${m.match_score}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold ${matchScoreColor(m.match_score)}`}>{m.match_score}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Jobs + candidates */}
      {jobs.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <Briefcase size={36} className="text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">{ar ? "لا توجد وظائف بعد" : "No jobs yet"}</p>
          <p className="text-xs text-muted-foreground">
            {ar
              ? "أضف وظيفة وارفع سير ذاتية لبدء عملية التوظيف"
              : "Add a job and upload CVs to start the hiring pipeline"}
          </p>
          <div className="flex justify-center gap-2 pt-1">
            <Button size="sm" onClick={() => navigate("/recruiter/jobs")}>
              <Briefcase size={13} className="mr-1.5" />
              {ar ? "إضافة وظيفة" : "Add Job"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/recruiter/candidates?action=upload")}>
              <Upload size={13} className="mr-1.5" />
              {ar ? "رفع سيرة ذاتية" : "Upload CV"}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{ar ? "الوظائف والمرشحون" : "Jobs & Candidates"}</h2>
            <button
              onClick={() => navigate("/recruiter/candidates")}
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              {ar ? "عرض جميع المرشحين" : "All candidates"}
              <ChevronRight size={12} />
            </button>
          </div>

          {jobs.map((job) => (
            <JobPanel key={job.id} job={job} ar={ar} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
};

export default RecruiterDashboard;


