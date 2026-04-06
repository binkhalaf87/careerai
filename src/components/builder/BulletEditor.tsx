import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles, Loader2, Trash2, GripVertical, RotateCcw,
  Zap, PenLine, Minimize2, Target, BarChart3, FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface BulletAction {
  id: string;
  label: string;
  labelAr: string;
  icon: React.ComponentType<any>;
}

export const BULLET_ACTIONS: BulletAction[] = [
  { id: "improve", label: "Improve Bullet", labelAr: "تحسين النقطة", icon: Sparkles },
  { id: "rewrite", label: "Rewrite Bullet", labelAr: "إعادة كتابة", icon: PenLine },
  { id: "shorten", label: "Shorten", labelAr: "اختصار", icon: Minimize2 },
  { id: "achievement", label: "Make Achievement Focused", labelAr: "ركّز على الإنجاز", icon: Target },
  { id: "measurable", label: "Add Measurable Impact", labelAr: "أضف أثراً قابلاً للقياس", icon: BarChart3 },
  { id: "ats", label: "Make ATS Friendly", labelAr: "توافق ATS", icon: FileSearch },
];

interface BulletEditorProps {
  bulletId: string;
  text: string;
  onChange: (text: string) => void;
  onDelete: () => void;
  onAiAction: (action: string) => Promise<void>;
  isRTL: boolean;
  language: string;
  disabled?: boolean;
}

const BulletEditor = ({
  text,
  onChange,
  onDelete,
  onAiAction,
  isRTL,
  language,
  disabled = false,
}: BulletEditorProps) => {
  const [improving, setImproving] = useState(false);
  const [originalText, setOriginalText] = useState<string | null>(null);

  const handleAction = async (actionId: string) => {
    if (improving) return;
    setOriginalText(text);
    setImproving(true);
    try {
      await onAiAction(actionId);
    } finally {
      setImproving(false);
    }
  };

  const handleRestore = () => {
    if (originalText !== null) {
      onChange(originalText);
      setOriginalText(null);
    }
  };

  return (
    <div className="group flex items-start gap-2 py-1.5">
      <div className="mt-2.5 text-muted-foreground/40 cursor-grab">
        <GripVertical size={14} />
      </div>

      <span className="mt-2 text-primary font-bold text-sm select-none">•</span>

      <div className="flex-1 min-w-0">
        <Input
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-primary/30 px-2 h-9 text-sm",
            isRTL && "text-right"
          )}
          dir={isRTL ? "rtl" : "ltr"}
          disabled={disabled || improving}
          placeholder={isRTL ? "اكتب إنجازك هنا..." : "Write your achievement here..."}
        />
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
        {originalText !== null && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleRestore}
            title={isRTL ? "استعادة الأصل" : "Restore Original"}
          >
            <RotateCcw size={13} />
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
              disabled={improving || !text.trim()}
            >
              {improving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Zap size={13} />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {BULLET_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <DropdownMenuItem
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  className="gap-2 text-sm"
                >
                  <Icon size={14} className="text-primary" />
                  {isRTL ? action.labelAr : action.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );
};

export default BulletEditor;
