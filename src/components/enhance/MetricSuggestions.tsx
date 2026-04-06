import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Hash, Plus } from "lucide-react";

interface MetricSuggestion {
  id: string;
  label: string;
  labelAr: string;
  placeholder: string;
  placeholderAr: string;
}

const METRIC_TEMPLATES: MetricSuggestion[] = [
  { id: "team_size", label: "Team size managed", labelAr: "حجم الفريق الذي أدرته", placeholder: "e.g. 12 team members", placeholderAr: "مثال: 12 عضو" },
  { id: "achievement_pct", label: "Achievement percentage", labelAr: "نسبة الإنجاز", placeholder: "e.g. Increased sales by 30%", placeholderAr: "مثال: زيادة المبيعات 30%" },
  { id: "projects_count", label: "Number of projects", labelAr: "عدد المشاريع", placeholder: "e.g. 15+ projects", placeholderAr: "مثال: أكثر من 15 مشروع" },
  { id: "budget", label: "Budget managed", labelAr: "الميزانية المُدارة", placeholder: "e.g. $500K budget", placeholderAr: "مثال: ميزانية 500 ألف" },
];

interface MetricSuggestionsProps {
  experience: string;
  onAddMetric: (metricText: string) => void;
  isRTL?: boolean;
  t: (en: string, ar: string) => string;
}

const MetricSuggestions = ({ experience, onAddMetric, isRTL, t }: MetricSuggestionsProps) => {
  const [values, setValues] = useState<Record<string, string>>({});

  const hasNumbers = useMemo(() => /\d+%?/.test(experience), [experience]);

  // Only show if experience lacks numbers
  if (hasNumbers) return null;

  const handleAdd = (id: string) => {
    const val = values[id]?.trim();
    if (!val) return;
    onAddMetric(val);
    setValues(prev => ({ ...prev, [id]: "" }));
  };

  return (
    <Card className="mt-4 border-border">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
          <Hash className="w-4 h-4 text-primary" />
          {t("Add Metrics & Numbers", "أضف أرقام وإحصائيات")}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            "Resumes with numbers are 40% more likely to pass ATS. Add real metrics from your experience.",
            "السير الذاتية بأرقام تجتاز ATS بنسبة 40% أعلى. أضف إحصائيات حقيقية من خبرتك."
          )}
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-2.5">
        {METRIC_TEMPLATES.map((metric) => (
          <div key={metric.id} className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                {isRTL ? metric.labelAr : metric.label}
              </label>
              <div className="flex gap-1.5">
                <Input
                  value={values[metric.id] || ""}
                  onChange={(e) => setValues(prev => ({ ...prev, [metric.id]: e.target.value }))}
                  placeholder={isRTL ? metric.placeholderAr : metric.placeholder}
                  className="h-8 text-sm"
                  dir={isRTL ? "rtl" : "ltr"}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 shrink-0"
                  onClick={() => handleAdd(metric.id)}
                  disabled={!values[metric.id]?.trim()}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default MetricSuggestions;
