import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  User,
  CheckCircle2,
  Trash2,
  Brain,
  Mail,
  XCircle,
  Eye,
  TrendingUp,
  ArrowUpDown,
  Star,
  AlertCircle,
  Zap,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  triggerMatchCalculation,
  useRecalcMatches,
  matchScoreColor,
  matchScoreBg,
  matchScoreLabel,
  matchBarColor,
  relativeTime,
  type JobMatch,
} from "@/hooks/useJobMatches";
import { RefreshMatchesButton } from "@/components/recruiter/Refreshmatchesbutton";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  title: string;
  department: string | null;
  seniority: string | null;
  status: string;
  description: string | null;
  required_skills: string[] | null;
  preferred_skills: string[] | null;
  minimum_experience_years: number | null;
  created_at: string;
}

// ─── Score helpers ─────────────────────────────────────────────────────────

function scoreLabel(score: number | null, ar: boolean): string {
  if (score == null) return "—";
  if (score >= 80) return ar ? "ممتاز" : "Excellent";
  if (score >= 60) return ar ? "جيد" : "Good";
  if (score >= 40) return ar ? "مقبول" : "Fair";
  return ar ? "ضعيف" : "Weak";
}

function scoreBgClass(score: number | null): string {
  if (score == null) return "bg-muted text-muted-foreground border-border";
  if (score >= 80) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 60) return "bg-blue-100 text-blue-700 border-blue-200";
  if (score >= 40) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function scoreBarCls(score: number | null): string {
  if (score == null) return "bg-muted";
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-400";
}

function scoreTextCls(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600 font-bold";
  if (score >= 60) return "text-blue-600 font-bold";
  if (score >= 40) return "text-amber-600 font-bold";
  return "text-red-500 font-bold";
}

// ─── Candidate match row ────────────────────────────────────────────────────

function CandidateMatchRow({
  match,
  ar,
  navigate,
  isTop,
  onStageUpdate,
}: {
  match: JobMatch;
  ar: boolean;
  navigate: (p: string) => void;
  isTop: boolean;
  onStageUpdate?: (id: string, stage: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [stageLoading, setStageLoading] = useState(false);
  const score = match.match_score;

  const initials = (match.candidate_name || "?")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const handleStage = async (stage: string) => {
    setStageLoading(true);
    try {
      const { error } = await supabase.from("recruiter_candidates").update({ stage }).eq("id", match.candidate_id);
      if (error) throw error;
      toast.success(ar ? "تم التحديث" : "Stage updated");
      onStageUpdate?.(match.candidate_id, stage);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setStageLoading(false);
    }
  };

  const breakdownItems = [
    { label: ar ? "العنوان" : "Title", score: match.title_score, icon: "💼" },
    { label: ar ? "المهارات" : "Skills", score: match.skills_score, icon: "🛠" },
    { label: ar ? "الخبرة" : "Exp.", score: match.experience_score, icon: "📅" },
    { label: ar ? "الكلمات" : "Keywords", score: match.keyword_score, icon: "🔑" },
  ];

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-200 ${
        expanded ? "border-primary/30 shadow-sm" : "border-border hover:border-primary/20"
      } bg-card`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative shrink-0">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {initials}
          </div>
          {isTop && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-amber-400 rounded-full flex items-center justify-center">
              <Star size={8} className="text-white" fill="white" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">
              {match.candidate_name ?? (ar ? "مرشح" : "Candidate")}
            </p>
            {isTop && (
              <span className="text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                {ar ? "الأفضل" : "Top"}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{match.candidate_title || "—"}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden mb-0.5">
              <div
                className={`h-full rounded-full ${scoreBarCls(score)} transition-all duration-700`}
                style={{ width: `${score ?? 0}%` }}
              />
            </div>
            <span className={`text-xs ${scoreTextCls(score)}`}>{score != null ? `${score}%` : "—"}</span>
          </div>
          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${scoreBgClass(score)}`}>
            {scoreLabel(score, ar)}
          </span>
          <button onClick={() => setExpanded((v) => !v)} className="p-1 rounded hover:bg-muted transition-colors">
            {expanded ? (
              <ChevronUp size={14} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={14} className="text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {breakdownItems.map((item) => (
              <div key={item.label} className="rounded-lg bg-card border border-border p-2 text-center">
                <div className="text-base mb-0.5">{item.icon}</div>
                <div className="text-[10px] text-muted-foreground mb-1">{item.label}</div>
                <div className={`text-sm font-bold ${scoreTextCls(item.score)}`}>{item.score ?? "—"}%</div>
                <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${scoreBarCls(item.score)} rounded-full`}
                    style={{ width: `${item.score ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {match.match_reasons?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {match.match_reasons.slice(0, 5).map((r, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-[11px] bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5"
                >
                  <CheckCircle2 size={9} /> {r}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs gap-1.5 px-3"
              onClick={() => navigate(`/recruiter/candidates/${match.candidate_id}`)}
            >
              <Eye size={11} />
              {ar ? "عرض الملف" : "View Profile"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 px-3"
              onClick={() =>
                navigate(
                  `/recruiter/questions?candidate=${match.candidate_id}&name=${encodeURIComponent(match.candidate_name || "")}`,
                )
              }
            >
              <Brain size={11} />
              {ar ? "مقابلة AI" : "AI Interview"}
            </Button>
            {match.candidate_email && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 px-3" asChild>
                <a href={`mailto:${match.candidate_email}`}>
                  <Mail size={11} />
                  {ar ? "إرسال بريد" : "Email"}
                </a>
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs gap-1.5 px-3"
              disabled={stageLoading}
              onClick={() => handleStage("shortlisted")}
            >
              {stageLoading ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={11} />}
              {ar ? "اختيار" : "Shortlist"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={stageLoading}
              onClick={() => handleStage("rejected")}
            >
              <XCircle size={11} />
              {ar ? "رفض" : "Reject"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI Insight Box ─────────────────────────────────────────────────────────

function AIInsightBox({ matches, ar }: { matches: JobMatch[]; ar: boolean }) {
  if (!matches.length) return null;
  const avgScore = Math.round(matches.reduce((s, m) => s + (m.match_score ?? 0), 0) / matches.length);
  const weakSkills = matches.filter((m) => (m.skills_score ?? 0) < 50).length;
  const strongExp = matches.filter((m) => (m.experience_score ?? 0) >= 70).length;

  const insights: string[] = [];
  if (weakSkills > matches.length / 2)
    insights.push(
      ar ? `${weakSkills} مرشحين يفتقرون للمهارات المطلوبة` : `${weakSkills} candidates lack required skills`,
    );
  if (strongExp > 0)
    insights.push(ar ? `${strongExp} مرشحين لديهم خبرة قوية` : `${strongExp} candidates have strong experience`);
  if (avgScore < 50)
    insights.push(
      ar ? "مجموعة التطابق ضعيفة — قد تحتاج لتوسيع البحث" : "Match pool is weak — consider broadening search",
    );
  if (avgScore >= 70) insights.push(ar ? "مجموعة تطابق ممتازة لهذه الوظيفة" : "Excellent match pool for this role");

  if (!insights.length) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-start gap-2">
      <Zap size={13} className="text-primary mt-0.5 shrink-0" />
      <div className="space-y-0.5">
        {insights.slice(0, 2).map((ins, i) => (
          <p key={i} className="text-xs text-foreground">
            {ins}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── Job Card ───────────────────────────────────────────────────────────────

function JobCard({
  job,
  ar,
  navigate,
  onDelete,
}: {
  job: Job;
  ar: boolean;
  navigate: (p: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [matches, setMatches] = useState<JobMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"match" | "experience" | "skills">("match");
  const [showAll, setShowAll] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("recruiter_candidate_job_matches")
        .select(
          `id, candidate_id, job_id, match_score, title_score, skills_score,
           experience_score, keyword_score, match_reasons, updated_at,
           recruiter_candidates!inner (name, current_title, stage, email)`,
        )
        .eq("job_id", job.id)
        .order("match_score", { ascending: false })
        .limit(50);

      setMatches(
        (data || []).map((r: any) => ({
          id: r.id,
          candidate_id: r.candidate_id,
          job_id: r.job_id,
          match_score: r.match_score,
          title_score: r.title_score,
          skills_score: r.skills_score,
          experience_score: r.experience_score,
          keyword_score: r.keyword_score,
          match_reasons: r.match_reasons || [],
          updated_at: r.updated_at,
          candidate_name: r.recruiter_candidates?.name,
          candidate_title: r.recruiter_candidates?.current_title,
          candidate_stage: r.recruiter_candidates?.stage,
          candidate_email: r.recruiter_candidates?.email,
        })),
      );
    } catch {
      setMatches([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMatches();
  }, [job.id]);

  const handleToggle = async () => {
    if (!expanded && matches === null) await loadMatches();
    setExpanded((v) => !v);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await (supabase as any).from("recruiter_candidate_job_matches").delete().eq("job_id", job.id);
      const { error } = await supabase.from("recruiter_jobs").delete().eq("id", job.id);
      if (error) throw error;
      toast.success(ar ? "تم حذف الوظيفة" : "Job deleted");
      setDeleteOpen(false);
      onDelete(job.id);
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const sorted = [...(matches || [])].sort((a, b) => {
    if (sortBy === "skills") return (b.skills_score ?? 0) - (a.skills_score ?? 0);
    if (sortBy === "experience") return (b.experience_score ?? 0) - (a.experience_score ?? 0);
    return (b.match_score ?? 0) - (a.match_score ?? 0);
  });
  const displayed = showAll ? sorted : sorted.slice(0, 3);
  const topScore = matches?.length ? Math.max(...matches.map((m) => m.match_score ?? 0)) : null;
  const avgScore = matches?.length
    ? Math.round(matches.reduce((s, m) => s + (m.match_score ?? 0), 0) / matches.length)
    : null;

  // Derive staleness from loaded matches
  const hasStale = matches?.some((m) => m.is_stale) ?? false;
  const latestUpdated = matches?.length
    ? matches.reduce<string | null>((latest, m) => {
        if (!m.updated_at) return latest;
        return !latest || m.updated_at > latest ? m.updated_at : latest;
      }, null)
    : null;

  return (
    <>
      <Card className="overflow-hidden border border-border hover:border-primary/25 transition-all duration-200 shadow-sm">
        {/* ─── Job Header ─── */}
        <div className="p-4 md:p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Briefcase size={18} className="text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-foreground">{job.title}</h3>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                    job.status === "open"
                      ? "bg-green-100 text-green-700 border-green-200"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {ar ? (job.status === "open" ? "مفتوح" : "مغلق") : job.status}
                </span>
                {matches && matches.length > 0 && (
                  <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {matches.length} {ar ? "مرشح" : "candidates"}
                  </span>
                )}
                {topScore != null && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${scoreBgClass(topScore)}`}
                  >
                    {ar ? "أعلى:" : "Top:"} {topScore}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {[job.department, job.seniority].filter(Boolean).join(" • ") || "—"}
              </p>
              {job.required_skills && job.required_skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {job.required_skills.slice(0, 6).map((s, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-primary/8 text-primary border border-primary/20 rounded-md px-1.5 py-0.5 font-medium"
                    >
                      {s}
                    </span>
                  ))}
                  {job.required_skills.length > 6 && (
                    <span className="text-[10px] text-muted-foreground self-center">
                      +{job.required_skills.length - 6}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ─── Actions ─── */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {/* Refresh Matches button — per job */}
              <RefreshMatchesButton
                jobId={job.id}
                ar={ar}
                isStale={hasStale}
                lastUpdated={latestUpdated}
                showMeta={!!latestUpdated}
                onSuccess={async () => {
                  await loadMatches();
                }}
              />

              <Button
                size="sm"
                variant={expanded ? "secondary" : "outline"}
                className="h-8 text-xs gap-1.5"
                onClick={handleToggle}
              >
                <Sparkles size={12} />
                {expanded ? (ar ? "إخفاء" : "Hide") : ar ? "المرشحون" : "Candidates"}
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
                title={ar ? "حذف الوظيفة" : "Delete job"}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>

          {/* Summary metrics */}
          {matches && matches.length > 0 && (
            <div className="flex gap-3 mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={12} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{ar ? "متوسط التطابق:" : "Avg match:"}</span>
                <span className={`text-xs font-semibold ${scoreTextCls(avgScore)}`}>{avgScore}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star size={12} className="text-amber-500" />
                <span className="text-xs text-muted-foreground">{ar ? "أفضل مرشح:" : "Top candidate:"}</span>
                <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                  {sorted[0]?.candidate_name || "—"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ─── Candidates Panel ─── */}
        {expanded && (
          <div className="border-t border-border bg-muted/20 px-4 md:px-5 py-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {ar ? "جاري تحميل النتائج..." : "Loading matches…"}
              </div>
            ) : !matches || matches.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <User size={24} className="opacity-40" />
                <p>{ar ? "لا يوجد مرشحون مطابقون لهذه الوظيفة" : "No matched candidates for this job"}</p>
                <p className="text-xs opacity-70">
                  {ar
                    ? "ارفع سيرة ذاتية أو أضف مرشحاً لبدء المطابقة"
                    : "Upload a CV or add candidates to start matching"}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <AIInsightBox matches={matches} ar={ar} />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ArrowUpDown size={11} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{ar ? "ترتيب:" : "Sort:"}</span>
                    {(["match", "skills", "experience"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSortBy(s)}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                          sortBy === s
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {s === "match"
                          ? ar
                            ? "التطابق"
                            : "Match"
                          : s === "skills"
                            ? ar
                              ? "المهارات"
                              : "Skills"
                            : ar
                              ? "الخبرة"
                              : "Exp."}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {displayed.map((m, idx) => (
                    <CandidateMatchRow
                      key={m.id}
                      match={m}
                      ar={ar}
                      navigate={navigate}
                      isTop={idx === 0 && sortBy === "match"}
                      onStageUpdate={() => {}}
                    />
                  ))}
                </div>

                {sorted.length > 3 && (
                  <button
                    onClick={() => setShowAll((v) => !v)}
                    className="w-full text-center text-xs text-primary hover:underline py-1 flex items-center justify-center gap-1"
                  >
                    {showAll
                      ? ar
                        ? "عرض أقل"
                        : "Show less"
                      : ar
                        ? `عرض جميع المرشحين (${sorted.length})`
                        : `View all ${sorted.length} candidates`}
                    {showAll ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      {/* ─── Delete Confirmation ─── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 size={16} />
              {ar ? "حذف الوظيفة" : "Delete Job"}
            </DialogTitle>
            <DialogDescription className="space-y-1">
              <span className="block">
                {ar ? `هل أنت متأكد من حذف "${job.title}"؟` : `Are you sure you want to delete "${job.title}"?`}
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 text-xs mt-1">
                <AlertCircle size={12} />
                {ar
                  ? "سيتم إزالة جميع ارتباطات المرشحين بهذه الوظيفة."
                  : "This will remove all candidate associations for this job."}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 size={14} className="mr-2" />}
              {ar ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

const RecruiterJobs = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ar = language === "ar";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    department: "",
    seniority: "",
    description: "",
    required_skills: "",
    preferred_skills: "",
    minimum_experience_years: "",
  });
  const [saving, setSaving] = useState(false);

  // Global recalculate-all button state
  const { recalculate: recalcAll, status: recalcStatus } = useRecalcMatches();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("recruiter_jobs")
      .select(
        "id, title, department, seniority, status, description, required_skills, preferred_skills, minimum_experience_years, created_at",
      )
      .eq("recruiter_id", user.id)
      .order("created_at", { ascending: false });
    setJobs((data || []) as Job[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (id: string) => setJobs((prev) => prev.filter((j) => j.id !== id));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.title.trim()) return;
    setSaving(true);

    const reqSkills = form.required_skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const prefSkills = form.preferred_skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const minExp = form.minimum_experience_years ? parseFloat(form.minimum_experience_years) : null;

    const { data: inserted, error } = await (supabase as any)
      .from("recruiter_jobs")
      .insert({
        recruiter_id: user.id,
        title: form.title.trim(),
        department: form.department.trim() || null,
        seniority: form.seniority.trim() || null,
        description: form.description.trim() || null,
        required_skills: reqSkills.length > 0 ? reqSkills : null,
        preferred_skills: prefSkills.length > 0 ? prefSkills : null,
        minimum_experience_years: minExp,
      })
      .select("id")
      .single();

    setSaving(false);
    if (error) {
      toast.error("Failed");
      return;
    }

    toast.success(ar ? "تم الإنشاء" : "Job created");
    setOpen(false);
    setForm({
      title: "",
      department: "",
      seniority: "",
      description: "",
      required_skills: "",
      preferred_skills: "",
      minimum_experience_years: "",
    });
    load();
    if (inserted?.id) triggerMatchCalculation({ job_id: inserted.id });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1200px] mx-auto w-full">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">{ar ? "الوظائف" : "Jobs"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ar ? `${jobs.length} وظيفة نشطة` : `${jobs.length} active job${jobs.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Global recalculate all jobs */}
          <Button
            size="sm"
            variant="outline"
            disabled={recalcStatus === "loading" || jobs.length === 0}
            onClick={() => recalcAll()}
            className="gap-1.5 text-xs"
            title={ar ? "إعادة حساب مطابقة جميع الوظائف" : "Recalculate matches for all jobs"}
          >
            <RefreshCw size={13} className={recalcStatus === "loading" ? "animate-spin" : ""} />
            {recalcStatus === "loading"
              ? ar
                ? "جاري التحديث..."
                : "Updating…"
              : recalcStatus === "success"
                ? ar
                  ? "تم ✓"
                  : "Done ✓"
                : ar
                  ? "تحديث الكل"
                  : "Refresh All"}
          </Button>

          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            {ar ? "+ وظيفة جديدة" : "+ New Job"}
          </Button>
        </div>
      </div>

      {/* ─── Jobs list ─── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : jobs.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Briefcase className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">{ar ? "لا توجد وظائف بعد" : "No jobs yet"}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {ar ? "أنشئ وظيفتك الأولى للبدء في مطابقة المرشحين" : "Create your first job to start matching candidates"}
          </p>
          <Button size="sm" className="mt-4" onClick={() => setOpen(true)}>
            <Plus size={13} className="mr-1.5" />
            {ar ? "إنشاء وظيفة" : "Create Job"}
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} ar={ar} navigate={navigate} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* ─── Create dialog ─── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{ar ? "وظيفة جديدة" : "Create Job Opening"}</DialogTitle>
            <DialogDescription>
              {ar ? "أضف تفاصيل الوظيفة لبدء مطابقة المرشحين" : "Add job details to start matching candidates"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 py-2">
            <Input
              placeholder={ar ? "المسمى الوظيفي *" : "Job Title *"}
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
              className="bg-card"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder={ar ? "القسم" : "Department"}
                value={form.department}
                onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                className="bg-card"
              />
              <Input
                placeholder={ar ? "مستوى الأقدمية" : "Seniority Level"}
                value={form.seniority}
                onChange={(e) => setForm((p) => ({ ...p, seniority: e.target.value }))}
                className="bg-card"
              />
            </div>
            <Input
              placeholder={ar ? "المهارات المطلوبة (مفصولة بفاصلة)" : "Required Skills (comma-separated)"}
              value={form.required_skills}
              onChange={(e) => setForm((p) => ({ ...p, required_skills: e.target.value }))}
              className="bg-card"
            />
            <Input
              placeholder={ar ? "المهارات المفضلة (مفصولة بفاصلة)" : "Preferred Skills (comma-separated)"}
              value={form.preferred_skills}
              onChange={(e) => setForm((p) => ({ ...p, preferred_skills: e.target.value }))}
              className="bg-card"
            />
            <Input
              type="number"
              placeholder={ar ? "الحد الأدنى لسنوات الخبرة" : "Min. Experience Years"}
              value={form.minimum_experience_years}
              onChange={(e) => setForm((p) => ({ ...p, minimum_experience_years: e.target.value }))}
              className="bg-card"
            />
            <Textarea
              placeholder={ar ? "وصف الوظيفة" : "Job Description"}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="bg-card"
              rows={3}
            />
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {ar ? "إنشاء الوظيفة" : "Create Job"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecruiterJobs;


