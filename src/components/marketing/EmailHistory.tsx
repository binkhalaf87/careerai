import { Clock, Trash2, Send, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

interface SavedEmail {
  id: string;
  subject: string;
  body: string;
  job_title: string;
  industry: string;
  company_name: string | null;
  language: string;
  tone: string;
  action_type: string;
  recipient_email: string | null;
  recruiter_name: string | null;
  created_at: string;
}

interface EmailHistoryProps {
  history: SavedEmail[];
  onDelete: (id: string) => void;
}

const EmailHistory = ({ history, onDelete }: EmailHistoryProps) => {
  const { t } = useLanguage();

  const actionBadge = (type: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      generated: { label: t.marketing.statusGenerated, cls: "bg-muted text-muted-foreground" },
      draft: { label: t.marketing.statusDraft, cls: "bg-accent text-accent-foreground" },
      sent: { label: t.marketing.statusSent, cls: "bg-primary/10 text-primary" },
    };
    const item = map[type] || map.generated;
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-display font-medium ${item.cls}`}>{item.label}</span>;
  };

  return (
    <div className="p-6 bg-card rounded-xl border border-border">
      <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
        <Clock size={18} className="text-primary" />
        {t.marketing.history}
      </h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground font-body text-center py-4">{t.marketing.noHistory}</p>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <div key={item.id} className="p-4 bg-background rounded-lg border border-border">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-body">{item.job_title} · {item.industry}</span>
                  {item.company_name && <span className="text-xs text-muted-foreground font-body">· {item.company_name}</span>}
                  {actionBadge(item.action_type)}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground font-body">{new Date(item.created_at).toLocaleDateString()}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(item.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              {item.recipient_email && (
                <p className="text-xs text-muted-foreground font-body mb-1">
                  <Send size={10} className="inline mr-1" />{item.recipient_email}
                  {item.recruiter_name && ` (${item.recruiter_name})`}
                </p>
              )}
              <p className="text-sm font-display font-medium text-foreground" dir={item.language === "ar" ? "rtl" : "ltr"}>{item.subject}</p>
              <p className="text-xs text-muted-foreground font-body mt-1 line-clamp-2" dir={item.language === "ar" ? "rtl" : "ltr"}>{item.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailHistory;
export type { SavedEmail };
