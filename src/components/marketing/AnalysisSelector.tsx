import { useState, useEffect } from "react";
import { BarChart3, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";

interface AnalysisOption {
  id: string;
  overall_score: number;
  created_at: string;
  strengths: string[] | null;
}

interface AnalysisSelectorProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const AnalysisSelector = ({ selectedId, onSelect }: AnalysisSelectorProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [analyses, setAnalyses] = useState<AnalysisOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("analyses")
      .select("id, overall_score, created_at, strengths")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setAnalyses(data);
        setLoading(false);
      });
  }, [user]);

  if (loading) return <div className="text-sm text-muted-foreground font-body py-4 text-center">{t.marketing.loading}</div>;

  if (analyses.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-border bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground font-body">{t.marketing.noAnalyses}</p>
        <p className="text-xs text-muted-foreground font-body mt-1">{t.marketing.noAnalysisHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => onSelect(null)}
        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
          selectedId === null
            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
            : "border-border bg-background hover:border-primary/40"
        }`}
      >
        <span className="text-sm font-body text-muted-foreground">{t.marketing.skipAnalysis}</span>
      </button>
      {analyses.map((a) => (
        <button
          key={a.id}
          onClick={() => onSelect(a.id)}
          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
            selectedId === a.id
              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
              : "border-border bg-background hover:border-primary/40"
          }`}
        >
          <BarChart3 size={18} className={selectedId === a.id ? "text-primary" : "text-muted-foreground"} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-medium text-foreground">
              {t.marketing.atsScore}: {a.overall_score}/100
            </p>
            <p className="text-xs text-muted-foreground font-body">
              {new Date(a.created_at).toLocaleDateString()}
              {a.strengths && a.strengths.length > 0 && ` · ${a.strengths[0].substring(0, 50)}...`}
            </p>
          </div>
          {selectedId === a.id && <CheckCircle size={18} className="text-primary shrink-0" />}
        </button>
      ))}
    </div>
  );
};

export default AnalysisSelector;
