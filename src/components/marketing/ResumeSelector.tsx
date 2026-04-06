import { useState, useEffect } from "react";
import { FileText, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";

interface ResumeOption {
  id: string;
  file_name: string;
  created_at: string;
  type: "uploaded" | "generated";
}

interface ResumeSelectorProps {
  selectedId: string | null;
  onSelect: (id: string, type: "uploaded" | "generated") => void;
}

const ResumeSelector = ({ selectedId, onSelect }: ResumeSelectorProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: uploaded }, { data: generated }] = await Promise.all([
        supabase.from("resumes").select("id, file_name, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("generated_resumes").select("id, title, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      const items: ResumeOption[] = [
        ...(uploaded || []).map((r) => ({ id: r.id, file_name: r.file_name, created_at: r.created_at, type: "uploaded" as const })),
        ...(generated || []).map((r) => ({ id: r.id, file_name: r.title, created_at: r.created_at, type: "generated" as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setResumes(items);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="text-sm text-muted-foreground font-body py-4 text-center">{t.marketing.loading}</div>;

  if (resumes.length === 0) {
    return <div className="text-sm text-muted-foreground font-body py-4 text-center">{t.marketing.noResumes}</div>;
  }

  return (
    <div className="space-y-2">
      {resumes.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r.id, r.type)}
          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
            selectedId === r.id
              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
              : "border-border bg-background hover:border-primary/40"
          }`}
        >
          <FileText size={18} className={selectedId === r.id ? "text-primary" : "text-muted-foreground"} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-medium text-foreground truncate">{r.file_name}</p>
            <p className="text-xs text-muted-foreground font-body">
              {r.type === "uploaded" ? t.marketing.uploadedResume : t.marketing.generatedResume} · {new Date(r.created_at).toLocaleDateString()}
            </p>
          </div>
          {selectedId === r.id && <CheckCircle size={18} className="text-primary shrink-0" />}
        </button>
      ))}
    </div>
  );
};

export default ResumeSelector;
