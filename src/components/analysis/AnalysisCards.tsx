import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Sparkles, ChevronDown, AlertTriangle, TrendingUp, CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Score colour system ──────────────────────────────────────────────────────

interface ScoreColors {
  text: string;
  bg: string;
  fill: string;
  badge: string;
  border: string;
  glow: string;
}

export const getScoreColors = (score: number): ScoreColors => {
  if (score >= 80)
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500",
      fill: "#10b981",
      badge: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      border: "border-emerald-500/25",
      glow: "shadow-emerald-500/20",
    };
  if (score >= 60)
    return {
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500",
      fill: "#f59e0b",
      badge: "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/30",
      border: "border-amber-500/25",
      glow: "shadow-amber-500/20",
    };
  if (score >= 40)
    return {
      text: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-500",
      fill: "#f97316",
      badge: "bg-orange-500/12 text-orange-700 dark:text-orange-400 border-orange-500/30",
      border: "border-orange-500/25",
      glow: "shadow-orange-500/20",
    };
  return {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-500",
    fill: "#ef4444",
    badge: "bg-red-500/12 text-red-700 dark:text-red-400 border-red-500/30",
    border: "border-red-500/25",
    glow: "shadow-red-500/20",
  };
};

export const getScoreLabel = (score: number, language: string): string => {
  if (score >= 80) return language === "ar" ? "ممتاز" : "Excellent";
  if (score >= 60) return language === "ar" ? "جيد" : "Good";
  if (score >= 40) return language === "ar" ? "مقبول" : "Fair";
  return language === "ar" ? "ضعيف" : "Weak";
};

// ─── ScoreBar ─────────────────────────────────────────────────────────────────

interface ScoreBarProps {
  label: string;
  score: number;
  maxScore?: number;
  subtitle?: string;
  actionLabel?: string;
  actionTo?: string;
}

export const ScoreBar = ({ label, score, maxScore = 100, subtitle, actionLabel, actionTo }: ScoreBarProps) => {
  const { language } = useLanguage();
  const c = getScoreColors(score);
  const pct = Math.min((score / maxScore) * 100, 100);

  return (
    <div
      className={`group relative p-4 rounded-2xl border transition-all duration-200 bg-card
        hover:shadow-sm ${c.border}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-foreground leading-snug">{label}</p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${c.badge}`}>
            {getScoreLabel(score, language)}
          </span>
          <span className={`font-black text-xl tabular-nums leading-none ${c.text}`}>{score}</span>
        </div>
      </div>

      <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${c.bg}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {actionTo && actionLabel && (
        <div className="mt-3 flex justify-end">
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <Link to={actionTo}>
              <Sparkles size={11} className="mr-1" />
              {actionLabel}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── BreakdownCard ────────────────────────────────────────────────────────────

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
  const [expanded, setExpanded] = useState(false);
  const { t, language } = useLanguage();
  const c = getScoreColors(score);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-200 ${c.border} bg-card`}>
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/20 transition-colors"
      >
        {/* Score pill */}
        <div
          className={`w-12 h-12 rounded-xl flex-shrink-0 flex flex-col items-center justify-center gap-0.5
            ${score < 60 ? "bg-red-500/10" : score < 80 ? "bg-amber-500/10" : "bg-emerald-500/10"}`}
        >
          <span className={`font-black text-base tabular-nums leading-none ${c.text}`}>{score}</span>
          <div className={`w-5 h-1 rounded-full ${c.bg} opacity-70`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h4 className="font-semibold text-sm text-foreground truncate">{title}</h4>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 ${c.badge}`}>
              {getScoreLabel(score, language)}
            </span>
          </div>
          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${c.bg} transition-all duration-700`} style={{ width: `${score}%` }} />
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-3">
              {currentState && (
                <div className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                      {t.analysis.currentState}
                    </p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{currentState}</p>
                  </div>
                </div>
              )}
              {problem && (
                <div className="flex gap-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">
                      {t.analysis.problem}
                    </p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{problem}</p>
                  </div>
                </div>
              )}
              {improvement && (
                <div className="flex gap-3">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">
                      {t.analysis.recommendation}
                    </p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{improvement}</p>
                  </div>
                </div>
              )}
              {actionTo && actionLabel && (
                <Button asChild variant="outline" size="sm" className="w-full h-8 text-xs rounded-xl gap-1.5 mt-1">
                  <Link to={actionTo}>
                    <Sparkles size={11} />
                    {actionLabel}
                  </Link>
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── RecruiterItem ────────────────────────────────────────────────────────────

interface RecruiterItemProps {
  label: string;
  score: number;
  comment: string;
}

export const RecruiterItem = ({ label, score, comment }: RecruiterItemProps) => {
  const { language } = useLanguage();
  const c = getScoreColors(score);
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;

  return (
    <div className={`flex gap-4 p-4 rounded-2xl border bg-card transition-all ${c.border} hover:shadow-sm`}>
      {/* Mini circular gauge */}
      <div className="relative w-14 h-14 flex-shrink-0">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={r} fill="none" strokeWidth="3.5" stroke="currentColor" className="text-muted/40" />
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            strokeWidth="3.5"
            strokeDasharray={`${fill} ${circ}`}
            strokeLinecap="round"
            style={{ stroke: c.fill, transition: "stroke-dasharray 1.2s cubic-bezier(.22,1,.36,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-black text-sm tabular-nums leading-none ${c.text}`}>{score}</span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-semibold text-sm text-foreground">{label}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 ${c.badge}`}>
            {getScoreLabel(score, language)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed break-words">{comment}</p>
      </div>
    </div>
  );
};

// ─── QuickImprovement ─────────────────────────────────────────────────────────

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
  const [done, setDone] = useState(false);
  const { language } = useLanguage();

  const pk = String(priority || "").toLowerCase();
  const p: Record<string, { label: string; cls: string }> = {
    high: {
      label: language === "ar" ? "عالية" : "High",
      cls: "bg-red-500/12 text-red-700 dark:text-red-400 border-red-500/30",
    },
    medium: {
      label: language === "ar" ? "متوسطة" : "Medium",
      cls: "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/30",
    },
    low: {
      label: language === "ar" ? "منخفضة" : "Low",
      cls: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    },
  };
  const cfg = p[pk] || { label: priority, cls: "bg-muted text-muted-foreground border-border" };

  return (
    <div
      className={`flex gap-3 p-4 rounded-2xl border transition-all duration-300 ${
        done ? "opacity-40 bg-muted/30 border-border/40" : "bg-card border-border hover:border-border/80"
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => setDone(!done)}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
          done
            ? "bg-emerald-500 border-emerald-500"
            : "border-muted-foreground/30 hover:border-violet-500"
        }`}
        aria-label="Mark as done"
      >
        {done && <CheckCircle2 className="w-3 h-3 text-white" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold flex-shrink-0 ${cfg.cls}`}>
            {cfg.label}
          </span>
          <p className={`text-sm font-medium text-foreground leading-relaxed break-words ${done ? "line-through" : ""}`}>
            {description}
          </p>
        </div>
        {actionStep && (
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">→ {actionStep}</p>
        )}
        {!done && actionTo && actionLabel && (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2 mt-2 gap-1 text-violet-600 dark:text-violet-400 hover:text-violet-700"
          >
            <Link to={actionTo}>
              <Sparkles size={10} />
              {actionLabel}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

// ─── InterviewQuestion ────────────────────────────────────────────────────────

interface InterviewQuestionProps {
  index: number;
  question: string;
  direction: string;
}

export const InterviewQuestion = ({ index, question, direction }: InterviewQuestionProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden transition-all hover:border-border/80">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/20 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
          {index}
        </span>
        <p
          className="flex-1 text-sm font-semibold text-foreground leading-relaxed"
          dir="ltr"
          style={{ textAlign: "left" }}
        >
          {question}
        </p>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0 mt-0.5 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 px-4 pb-4 pt-3">
              <div className="flex gap-3 p-3 rounded-xl bg-violet-500/5 border border-violet-500/15">
                <span className="text-base flex-shrink-0">💡</span>
                <p
                  className="text-xs text-foreground/80 leading-relaxed"
                  dir="ltr"
                  style={{ textAlign: "left" }}
                >
                  {direction}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
