import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Upload, Briefcase, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserResumeData } from "@/hooks/useUserResume";

interface ResumeEntry {
  id: string;
  resume_id: string | null;
  detected_job_title: string | null;
  structured_resume_json: Record<string, any> | null;
  created_at: string;
  original_file_url: string;
}

interface Props {
  resumeData: UserResumeData | null;
  loading: boolean;
  ar: boolean;
  onResumeChange?: (resume: UserResumeData) => void;
}

export function ResumeProfileCard({ resumeData, loading, ar, onResumeChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    setListLoading(true);
    supabase
      .from("user_resumes" as never)
      .select("id, resume_id, detected_job_title, structured_resume_json, created_at, original_file_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data as ResumeEntry[] | null) || [];
        setResumes(rows);
        if (rows.length > 0) {
          const match = resumeData?.id ? rows.find((r) => r.id === resumeData.id) : null;
          setSelectedId(match?.id || rows[0].id);
        }
        setListLoading(false);
      });
  }, [user, resumeData?.id]);

  const handleChange = async (id: string) => {
    setSelectedId(id);
    if (!onResumeChange || !user) return;
    const { data } = await supabase
      .from("user_resumes" as never)
      .select("*")
      .eq("id", id)
      .single();
    if (data) onResumeChange(data as UserResumeData);
  };

  const getLabel = (r: ResumeEntry) => {
    const structured = r.structured_resume_json as Record<string, any> | null;
    const name = structured?.name || structured?.full_name || "";
    const title = r.detected_job_title || "";
    const date = new Date(r.created_at).toLocaleDateString(ar ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
    });
    if (name && title) return `${name} · ${title}`;
    if (name) return `${name} · ${date}`;
    if (title) return `${title} · ${date}`;
    return ar ? `سيرة ذاتية – ${date}` : `Resume – ${date}`;
  };

  if (loading || listLoading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-4 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <Skeleton className="h-9 flex-1 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (resumes.length === 0) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="p-5 flex flex-col items-center gap-3 text-center">
          <Upload className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {ar
              ? "لم يتم رفع سيرة ذاتية بعد. قم برفع سيرتك أولاً لتحسين نتائج البحث."
              : "No resume uploaded yet. Upload your resume first to improve search results."}
          </p>
          <Button size="sm" variant="outline" onClick={() => navigate("/dashboard")}>
            <Upload size={14} className={ar ? "ml-1.5" : "mr-1.5"} />
            {ar ? "رفع السيرة الذاتية" : "Upload Resume"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const selected = resumes.find((r) => r.id === selectedId);
  const selectedTitle = selected?.detected_job_title || "";

  return (
    <Card className="border-primary/20 bg-card">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">
              {ar ? "السيرة الذاتية المُقدَّم بها" : "Resume you're applying with"}
            </p>
            <Select value={selectedId} onValueChange={handleChange} dir={ar ? "rtl" : "ltr"}>
              <SelectTrigger className="h-9 text-sm border-border bg-background focus:ring-primary/30 w-full">
                <SelectValue placeholder={ar ? "اختر سيرتك الذاتية" : "Select a resume"} />
              </SelectTrigger>
              <SelectContent>
                {resumes.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-sm">
                    <span className="flex items-center gap-2">
                      <FileText size={13} className="text-muted-foreground shrink-0" />
                      <span className="truncate">{getLabel(r)}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Badge
            variant="secondary"
            className="shrink-0 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0 gap-1"
          >
            <CheckCircle2 size={10} />
            {ar ? "متصلة" : "Active"}
          </Badge>
        </div>

        {selectedTitle && (
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1 ps-12">
            <Briefcase size={10} />
            {selectedTitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
