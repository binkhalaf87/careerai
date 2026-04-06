import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { Sparkles, ChevronRight } from "lucide-react";

interface ScoreBarProps {
  label: string;
  score: number;
  maxScore?: number;
  subtitle?: string;
  actionLabel?: string;
  actionTo?: string;
}

const scoreColor = (score: number) => {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-primary";
  if (score >= 40) return "bg-yellow-500";
  return "bg-destructive";
};

const scoreTextColor = (score: number) => {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-yellow-600";
  return "text-destructive";
};

const scoreBadge = (score: number, language: string) => {
  if (score >= 80) return language === "ar" ? "قوي" : "Strong";
  if (score >= 60) return language === "ar" ? "جيد" : "Good";
  if (score >= 40) return language === "ar" ? "متوسط" : "Needs Work";
  return language === "ar" ? "ضعيف" : "Weak";
};

export const ScoreBar = ({ label, score, maxScore = 100, subtitle, actionLabel, actionTo }: ScoreBarProps) => {
  const { language } = useLanguage();

  return (
    <div className="p-4 bg-card rounded-xl border border-border">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-display font-medium text-foreground text-sm">{label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                score >= 80
                  ? "bg-success/10 text-success"
                  : score >= 60
                    ? "bg-primary/10 text-primary"
                    : score >= 40
                      ? "bg-yellow-500/10 text-yellow-700"
                      : "bg-destructive/10 text-destructive"
              }`}
            >
              {scoreBadge(score, language)}
            </span>
          </div>

          {subtitle && <p className="text-xs text-muted-foreground font-body leading-5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={`font-display font-bold text-sm ${scoreTextColor(score)}`}>
            {score}/{maxScore}
          </span>

          {actionTo && actionLabel && (
            <Button asChild variant="outline" size="sm">
              <Link to={actionTo}>
                <Sparkles size={14} className="mr-2" />
                {actionLabel}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mt-3">
        <div
          className={`h-full rounded-full transition-all duration-700 ${scoreColor(score)}`}
          style={{ width: `${Math.min((score / maxScore) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
};

interface BreakdownCardProps {
  title: string;
  score: number;
  currentState: string;
  problem: string;
  improvement: string;
  actionLabel?: string;
  actionTo?: string;
}

export const BreakdownCard = ({
  title,
  score,
  currentState,
  problem,
  improvement,
  actionLabel,
  actionTo,
}: BreakdownCardProps) => {
  const { t, language } = useLanguage();

  return (
    <div className="p-5 bg-card rounded-xl border border-border space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="font-display font-semibold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground mt-1">
            {score >= 80
              ? language === "ar"
                ? "هذا الجزء جيد"
                : "This area is performing well"
              : score >= 60
                ? language === "ar"
                  ? "يحتاج بعض التحسين"
                  : "Needs some improvement"
                : language === "ar"
                  ? "هذا الجزء يستحق المعالجة أولاً"
                  : "This area should be fixed first"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`font-display font-bold text-lg ${scoreTextColor(score)}`}>{score}</span>
          {actionTo && actionLabel && (
            <Button asChild variant="outline" size="sm">
              <Link to={actionTo}>
                {actionLabel}
                <ChevronRight size={14} className="ml-2" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${scoreColor(score)}`} style={{ width: `${score}%` }} />
      </div>

      <div className="space-y-2 text-sm font-body">
        <div>
          <span className="font-medium text-muted-foreground">{t.analysis.currentState}: </span>
          <span className="text-foreground">{currentState}</span>
        </div>
        <div>
          <span className="font-medium text-destructive">{t.analysis.problem}: </span>
          <span className="text-foreground">{problem}</span>
        </div>
        <div>
          <span className="font-medium text-success">{t.analysis.recommendation}: </span>
          <span className="text-foreground">{improvement}</span>
        </div>
      </div>
    </div>
  );
};

interface RecruiterItemProps {
  label: string;
  score: number;
  comment: string;
}

export const RecruiterItem = ({ label, score, comment }: RecruiterItemProps) => (
  <div className="p-4 bg-card rounded-xl border border-border">
    <div className="flex items-center justify-between mb-2">
      <span className="font-display font-medium text-foreground text-sm">{label}</span>
      <span className={`font-display font-bold text-sm ${scoreTextColor(score)}`}>{score}/100</span>
    </div>
    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
      <div className={`h-full rounded-full ${scoreColor(score)}`} style={{ width: `${score}%` }} />
    </div>
    <p className="text-sm text-muted-foreground font-body">{comment}</p>
  </div>
);

interface QuickImprovementProps {
  priority: string;
  description: string;
  actionStep: string;
  actionLabel?: string;
  actionTo?: string;
}

export const QuickImprovement = ({
  priority,
  description,
  actionStep,
  actionLabel,
  actionTo,
}: QuickImprovementProps) => {
  const { language } = useLanguage();

  const priorityKey = String(priority || "").toLowerCase();
  const priorityColor =
    {
      high: "bg-destructive/10 text-destructive border-destructive/20",
      medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
      low: "bg-success/10 text-success border-success/20",
    }[priorityKey] || "bg-muted text-muted-foreground border-border";

  const priorityLabel =
    priorityKey === "high"
      ? language === "ar"
        ? "عالية"
        : "High"
      : priorityKey === "medium"
        ? language === "ar"
          ? "متوسطة"
          : "Medium"
        : priorityKey === "low"
          ? language === "ar"
            ? "منخفضة"
            : "Low"
          : priority || (language === "ar" ? "أولوية" : "Priority");

  return (
    <div className="p-4 bg-card rounded-xl border border-border">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`text-xs font-display font-semibold px-2 py-0.5 rounded-full border ${priorityColor} shrink-0 mt-0.5`}
          >
            {priorityLabel}
          </span>

          <div>
            <p className="text-sm font-body font-medium text-foreground leading-6">{description}</p>
            <p className="text-sm font-body text-muted-foreground mt-1 leading-6">→ {actionStep}</p>
          </div>
        </div>

        {actionTo && actionLabel && (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to={actionTo}>
              <Sparkles size={14} className="mr-2" />
              {actionLabel}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

interface InterviewQuestionProps {
  index: number;
  question: string;
  direction: string;
}

export const InterviewQuestion = ({ index, question, direction }: InterviewQuestionProps) => (
  <div className="p-4 bg-card rounded-xl border border-border">
    <p className="text-sm font-display font-semibold text-foreground mb-1">
      {index}. {question}
    </p>
    <p className="text-sm font-body text-muted-foreground">💡 {direction}</p>
  </div>
);
