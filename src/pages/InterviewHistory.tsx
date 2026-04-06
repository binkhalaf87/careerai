import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MessageSquare,
  Calendar,
  Star,
  Loader2,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

interface InterviewSessionRow {
  id: string;
  session_title: string;
  job_title: string | null;
  overall_score: number | null;
  summary_json: any;
  created_at: string;
}

const InterviewHistory = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ar = language === "ar";

  const [sessions, setSessions] = useState<InterviewSessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("interview_sessions" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setSessions(data as any);
      setLoading(false);
    };
    load();
  }, [user]);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(ar ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const scoreColor = (score: number) => {
    if (score >= 7) return "text-success";
    if (score >= 5) return "text-primary";
    return "text-destructive";
  };

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
            {ar ? "سجل المقابلات" : "Interview History"}
          </span>
        </div>
      </header>

      <main className="container py-8 max-w-2xl space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : sessions.length === 0 ? (
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
            <Button onClick={() => navigate("/dashboard/interview-avatar")} className="gap-2">
              <MessageSquare size={16} />
              {ar ? "ابدأ مقابلة" : "Start Interview"}
            </Button>
          </motion.div>
        ) : (
          sessions.map((session, i) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card p-5 hover:border-primary/20 transition-colors cursor-pointer group"
              onClick={() => {
                // Could navigate to detail page
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-semibold text-foreground text-sm">{session.session_title}</h3>
                {session.overall_score != null && (
                  <Badge className={`${session.overall_score >= 7 ? "bg-success" : session.overall_score >= 5 ? "bg-primary" : "bg-destructive"} text-white`}>
                    <Star size={10} className="mr-1" />
                    {Math.round(session.overall_score * 10) / 10}/10
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {session.job_title && (
                  <span>{session.job_title}</span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {formatDate(session.created_at)}
                </span>
                {session.summary_json?.answered && (
                  <span>{session.summary_json.answered}/{session.summary_json.total_questions} {ar ? "أسئلة" : "Q"}</span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </main>
    </div>
  );
};

export default InterviewHistory;
