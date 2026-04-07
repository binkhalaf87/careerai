import { useMemo, useState } from "react";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadEnhancedResumeAsWord } from "@/lib/resume-docx";
import { parseResumeTextFallback } from "@/lib/resume-utils";

interface RewriteReviewProps {
  originalText?: string;
  improvedText?: string;
  summary?: string[];
}

export default function RewriteReview({ originalText = "", improvedText = "", summary = [] }: RewriteReviewProps) {
  const [mode, setMode] = useState<"improved" | "original">("improved");
  const activeText = mode === "improved" ? improvedText : originalText;
  const activeLabel = mode === "improved" ? "النسخة المحسنة / Enhanced Version" : "النسخة الأصلية / Original Version";

  const beforeAfter = useMemo(
    () => ({
      originalLines: originalText.split(/\n/).filter(Boolean).length,
      improvedLines: improvedText.split(/\n/).filter(Boolean).length,
      structured: parseResumeTextFallback(improvedText || originalText),
    }),
    [originalText, improvedText],
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(improvedText || activeText);
  };

  const handleWordDownload = async () => {
    await downloadEnhancedResumeAsWord({
      content: improvedText || activeText,
      fallbackStructured: beforeAfter.structured,
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">السيرة الذاتية المحسنة / Enhanced Resume</h3>
          <p className="text-sm text-muted-foreground">
            راجع النسخة النهائية ثم نزّلها بصيغة Word أو انسخها مباشرة. / Review the final version, then
            download it as Word or copy it directly.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={mode === "improved" ? "default" : "outline"} size="sm" onClick={() => setMode("improved")}>
            النسخة المحسنة / Enhanced
          </Button>
          <Button variant={mode === "original" ? "default" : "outline"} size="sm" onClick={() => setMode("original")}>
            النسخة الأصلية / Original
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">الأسطر الأصلية / Original Lines</span>
          <div className="font-semibold">{beforeAfter.originalLines}</div>
        </div>
        <div className="rounded-xl bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">الأسطر الحالية / Current Lines</span>
          <div className="font-semibold">{beforeAfter.improvedLines}</div>
        </div>
        <div className="rounded-xl bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">الملف المعروض / Current View</span>
          <div className="font-semibold">{activeLabel}</div>
        </div>
      </div>

      {summary.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">أبرز النقاط / Highlights</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {summary.map((item, index) => (
              <li key={`${item}-${index}`}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={handleCopy}>
          <Copy className="h-4 w-4" /> نسخ النص / Copy Text
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleWordDownload}>
          <Download className="h-4 w-4" /> Download as Word
        </Button>
      </div>

      <textarea
        readOnly
        value={activeText}
        className="min-h-[420px] w-full max-w-none rounded-xl border border-border bg-background p-4 text-left [direction:ltr] whitespace-pre-wrap break-words leading-6 outline-none"
      />
    </div>
  );
}


