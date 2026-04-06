import { useCallback, useRef, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Bold, Italic, Underline as UnderlineIcon, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResumeRichEditorProps {
  content: string;
  onChange: (html: string) => void;
  onRephraseSelection: (selectedText: string) => Promise<string | null>;
  isRTL?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

const ToolbarButton = ({
  active,
  onClick,
  children,
  disabled,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      "p-1.5 rounded-md transition-colors disabled:opacity-40",
      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    )}
  >
    {children}
  </button>
);

const ResumeRichEditor = ({
  content,
  onChange,
  onRephraseSelection,
  isRTL = false,
  placeholder: placeholderText = "Start typing...",
  disabled = false,
}: ResumeRichEditorProps) => {
  const [rephrasing, setRephrasing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = useCallback(
    (before: string, after?: string) => {
      const textarea = textareaRef.current;
      if (!textarea || disabled) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = content.slice(start, end);
      const suffix = after ?? before;

      const nextValue = `${content.slice(0, start)}${before}${selected}${suffix}${content.slice(end)}`;
      onChange(nextValue);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + before.length, end + before.length);
      });
    },
    [content, disabled, onChange],
  );

  const handleRephrase = useCallback(async () => {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end).trim();

    if (!selectedText) return;

    setRephrasing(true);
    try {
      const improved = await onRephraseSelection(selectedText);
      if (!improved?.trim()) return;

      const nextValue = `${content.slice(0, start)}${improved.trim()}${content.slice(end)}`;
      onChange(nextValue);

      requestAnimationFrame(() => {
        textarea.focus();
        const cursor = start + improved.trim().length;
        textarea.setSelectionRange(cursor, cursor);
      });
    } catch (error) {
      console.error("[ResumeRichEditor] rephrase failed:", error);
    } finally {
      setRephrasing(false);
    }
  }, [content, disabled, onChange, onRephraseSelection]);

  return (
    <div className="relative border border-border rounded-xl overflow-hidden bg-card shadow-sm">
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border bg-muted/30 flex-wrap">
        <ToolbarButton onClick={() => wrapSelection("**")} disabled={disabled} title="Bold">
          <Bold className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton onClick={() => wrapSelection("*")} disabled={disabled} title="Italic">
          <Italic className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton onClick={() => wrapSelection("<u>", "</u>")} disabled={disabled} title="Underline">
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <button
          type="button"
          onClick={handleRephrase}
          disabled={rephrasing || disabled}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {rephrasing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {isRTL ? "إعادة صياغة" : "Rephrase"}
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholderText}
        disabled={disabled}
        dir={isRTL ? "rtl" : "ltr"}
        className={cn(
          "w-full min-h-[360px] px-6 py-5 bg-transparent resize-y focus:outline-none text-sm leading-7",
          isRTL ? "text-right" : "text-left",
        )}
      />
    </div>
  );
};

export default ResumeRichEditor;
