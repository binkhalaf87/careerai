/**
 * TALENTRY — RecruiterInterviews.tsx  (UPDATED)
 *
 * Full Interview Hub — shows all sessions with results access.
 * NO DEAD ENDS: every session links to results or resume.
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Brain, Video, TrendingUp, User, Clock, Search, Play, ArrowRight, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Session {
  id: string;
  candidate_id: string;
  job_id: string | null;
  status: string;
  mode: string;
  overall_score: number | null;
  recommendation: string | null;
  evaluation_summary: string | null;
  created_at: string;
  completed_at: string | null;
  candidate_name?: string;
  candidate_title?: string;
  job_title?: string;
}

function scoreColor(score: number | null) {
  if (!score) return "text-muted-foreground";
  if (score >= 80) return "text-green-600 font-bold";
  if (score >= 60) return "text-blue-600 font-bold";
  if (score >= 40) return "text-amber-600 font-bold";
  return "text-red-500 font-bold";
}

function recBadge(rec: string | null) {
  if (!rec) return "bg-muted text-muted-foreground";
  if (rec === "Strong Hire" || rec === "Hire") return "bg-green-100 text-green-700";
  if (rec === "Reject") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function SessionCard({ session, ar, navigate }: { session: Session; ar: boolean; navigate: (p: string) => void }) {
  const isCompleted = session.status === "completed";
  const isInProgress = session.status === "in_progress";

  return (
    <Card className="p-4 hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => isCompleted
        ? navigate(`/recruiter/interview/${session.id}/results`)
        : navigate(`/recruiter/interview/${session.id}`)
      }
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {(session.candidate_name || "?").split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{session.candidate_name || "—"}</p>
            <p className="text-xs text-muted-foreground">{session.candidate_title || session.job_title || "—"}</p>
            {session.evaluation_summary && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 max-w-md">{session.evaluation_summary}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {session.overall_score != null && (
            <div className="text-end">
              <div className={`text-xl font-bold leading-none ${scoreColor(session.overall_score)}`}>
                {session.overall_score}
              </div>
              <div className="text-[10px] text-muted-foreground">/ 100</div>
            </div>
          )}
          {session.recommendation && (
            <Badge className={`text-[10px] ${recBadge(session.recommendation)}`}>
              {session.recommendation}
            </Badge>
          )}
          <Badge className={
            isCompleted ? "bg-violet-100 text-violet-700" :
            isInProgress ? "bg-blue-100 text-blue-700" :
            "bg-muted text-muted-foreground"
          }>
            {isCompleted ? (ar ? "مكتمل" : "Completed") :
             isInProgress ? (ar ? "جارٍ" : "In Progress") :
             ar ? "معلق" : "Pending"}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock size={11} />
            {new Date(session.created_at).toLocaleDateString()}
          </div>
          <ArrowRight size={16} className="text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}

const RecruiterInterviews = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ar = language === "ar";
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("recruiter_interview_sessions")
        .select(`
          id, candidate_id, job_id, status, mode,
          overall_score, recommendation, evaluation_summary,
          created_at, completed_at,
          recruiter_candidates(name, current_title),
          recruiter_jobs(title)
        `)
        .eq("recruiter_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      setSessions(
        (data || []).map((s: any) => ({
          ...s,
          candidate_name: s.recruiter_candidates?.name || "—",
          candidate_title: s.recruiter_candidates?.current_title || null,
          job_title: s.recruiter_jobs?.title || null,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = sessions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.candidate_name || "").toLowerCase().includes(q) ||
             (s.job_title || "").toLowerCase().includes(q);
    }
    return true;
  });

  const completed = sessions.filter((s) => s.status === "completed");
  const avgScore = completed.length
    ? Math.round(completed.reduce((sum, s) => sum + (s.overall_score || 0), 0) / completed.length)
    : null;
  const strongHires = completed.filter((s) => s.recommendation === "Strong Hire" || s.recommendation === "Hire").length;

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Brain size={20} className="text-primary" />
            {ar ? "المقابلات" : "Interviews"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ar ? "كل جلسات المقابلة AI" : "All AI interview sessions"}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate("/recruiter/candidates?action=upload")}>
          <Upload size={13} className="mr-1.5" />
          {ar ? "رفع مرشح جديد" : "Upload New CV"}
        </Button>
      </div>

      {/* Stats */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: ar ? "إجمالي الجلسات" : "Total Sessions", value: sessions.length, color: "bg-slate-100 text-slate-600" },
            { label: ar ? "مكتملة" : "Completed", value: completed.length, color: "bg-violet-100 text-violet-600" },
            { label: ar ? "متوسط النتيجة" : "Avg Score", value: avgScore != null ? `${avgScore}%` : "—", color: "bg-blue-100 text-blue-600" },
            { label: ar ? "توصية بالتعيين" : "Hire Recommended", value: strongHires, color: "bg-green-100 text-green-600" },
          ].map((stat) => (
            <Card key={stat.label} className="p-3 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${stat.color}`}>
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={ar ? "بحث بالاسم أو الوظيفة..." : "Search by name or job..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-card">
            <SelectValue placeholder={ar ? "الحالة" : "Status"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar ? "الكل" : "All"}</SelectItem>
            <SelectItem value="pending">{ar ? "معلق" : "Pending"}</SelectItem>
            <SelectItem value="in_progress">{ar ? "جارٍ" : "In Progress"}</SelectItem>
            <SelectItem value="completed">{ar ? "مكتمل" : "Completed"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Session list */}
      {filtered.length === 0 ? (
        <Card className="p-10 text-center space-y-4">
          <Brain size={36} className="text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">
            {sessions.length === 0
              ? ar ? "لا توجد مقابلات بعد" : "No interviews yet"
              : ar ? "لا توجد نتائج للفلتر الحالي" : "No results for current filter"}
          </p>
          {sessions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {ar
                ? "ارفع سيرة ذاتية لمرشح ثم اضغط 'ابدأ مقابلة AI' من صفحة الملف الشخصي"
                : "Upload a candidate CV then click 'Start AI Interview' from their profile"}
            </p>
          )}
          <Button size="sm" onClick={() => navigate("/recruiter/candidates?action=upload")}>
            <Upload size={13} className="mr-1.5" />
            {ar ? "رفع سيرة ذاتية" : "Upload CV"}
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {ar ? `عرض ${filtered.length} جلسة` : `Showing ${filtered.length} sessions`}
          </p>
          {filtered.map((s) => (
            <SessionCard key={s.id} session={s} ar={ar} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
};

export default RecruiterInterviews;


