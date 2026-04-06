import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Plus, FolderPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface MissingSectionsPanelProps {
  missingSections: { key: string; label: string }[];
  onAddSection: (key: string, content: string) => void;
  language: string;
  isRTL?: boolean;
  t: (en: string, ar: string) => string;
}

const MissingSectionsPanel = ({
  missingSections,
  onAddSection,
  language,
  isRTL,
  t,
}: MissingSectionsPanelProps) => {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [enhancing, setEnhancing] = useState(false);

  const handleAddWithAI = useCallback(async () => {
    if (!inputText.trim() || !activeTab) return;
    setEnhancing(true);
    try {
      const contentLang = (inputText.match(/[\u0600-\u06FF]/g) || []).length / Math.max(inputText.length, 1) > 0.3 ? "ar" : "en";
      const { data, error } = await supabase.functions.invoke("rephrase-selection", {
        body: { text: inputText, language: contentLang },
      });
      if (error) throw error;
      const improved = data?.rephrased || inputText;
      onAddSection(activeTab, improved.trim());
      toast({ title: t("✅ Section added to resume!", "✅ تم إضافة القسم للسيرة!") });
      setInputText("");
      setActiveTab(null);
    } catch (err) {
      console.error("Enhance error:", err);
      // Fallback: add raw text
      onAddSection(activeTab, inputText.trim());
      toast({ title: t("Section added (without AI)", "تم إضافة القسم (بدون ذكاء اصطناعي)") });
      setInputText("");
      setActiveTab(null);
    } finally {
      setEnhancing(false);
    }
  }, [inputText, activeTab, onAddSection, language, t]);

  const handleAddDirect = useCallback(() => {
    if (!inputText.trim() || !activeTab) return;
    onAddSection(activeTab, inputText.trim());
    toast({ title: t("✅ Section added!", "✅ تم الإضافة!") });
    setInputText("");
    setActiveTab(null);
  }, [inputText, activeTab, onAddSection, t]);

  if (missingSections.length === 0) return null;

  return (
    <Card className="mt-4 border-border">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-primary" />
          {t("Add Missing Sections", "أضف الأقسام المفقودة")}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="flex flex-wrap gap-2 mb-3">
          {missingSections.map((sec) => (
            <Badge
              key={sec.key}
              variant={activeTab === sec.key ? "default" : "outline"}
              className="cursor-pointer transition-colors"
              onClick={() => {
                setActiveTab(activeTab === sec.key ? null : sec.key);
                setInputText("");
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              {sec.label}
            </Badge>
          ))}
        </div>

        {activeTab && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t(
                `Write your ${missingSections.find(s => s.key === activeTab)?.label || "content"} here...`,
                `اكتب ${missingSections.find(s => s.key === activeTab)?.label || "المحتوى"} هنا...`
              )}
              className="min-h-[80px] text-sm"
              dir={isRTL ? "rtl" : "ltr"}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddDirect}
                disabled={!inputText.trim() || enhancing}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {t("Add as-is", "أضف كما هو")}
              </Button>
              <Button
                size="sm"
                onClick={handleAddWithAI}
                disabled={!inputText.trim() || enhancing}
              >
                {enhancing ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                )}
                {t("Improve & Add", "حسّن وأضف")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MissingSectionsPanel;
