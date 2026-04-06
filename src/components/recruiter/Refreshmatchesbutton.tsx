/**
 * TALENTRY — RefreshMatchesButton
 *
 * Props:
 *   jobId      — if provided, recalcs only this job; else recalcs all jobs
 *   ar         — Arabic language mode
 *   onSuccess  — called after successful recalculation (use to reload matches)
 *   variant    — button variant (default: "outline")
 *   showMeta   — show "Last updated: Xm ago" line below button
 *   lastUpdated — pass the updated_at from the most recent match record
 *
 * No polling. No per-card interval. Freshness display is driven by props
 * from the parent (JobCard already has the match data loaded).
 */

import { useEffect } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRecalcMatches, relativeTime } from "@/hooks/useJobMatches";

interface Props {
  jobId?: string;
  ar?: boolean;
  onSuccess?: () => void | Promise<void>;
  variant?: "default" | "ghost" | "outline" | "secondary";
  size?: "sm" | "default";
  showMeta?: boolean;
  lastUpdated?: string | null;
  isStale?: boolean;
  className?: string;
}

export function RefreshMatchesButton({
  jobId,
  ar = false,
  onSuccess,
  variant = "outline",
  size = "sm",
  showMeta = false,
  lastUpdated,
  isStale = false,
  className = "",
}: Props) {
  const { recalculate, status, result, error, lastRun } = useRecalcMatches();

  useEffect(() => {
    if (status === "success" && result) {
      toast.success(
        ar
          ? `تم تحديث ${result.matches} تطابق بنجاح`
          : `${result.matches} match${result.matches !== 1 ? "es" : ""} updated`,
        { duration: 3000 },
      );
      onSuccess?.();
    }
  }, [status, result]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === "error" && error) {
      toast.error(ar ? `فشل التحديث: ${error}` : `Refresh failed: ${error}`, { duration: 5000 });
    }
  }, [status, error]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading  = status === "loading";
  const isSuccess  = status === "success";
  const isError    = status === "error";
  const showStale  = isStale && !isLoading && !isSuccess;
  const displayDate = lastRun ? lastRun.toISOString() : lastUpdated;

  const label = isLoading
    ? (ar ? "جاري التحديث..." : "Updating…")
    : isSuccess
    ? (ar ? "تم التحديث ✓" : "Updated ✓")
    : jobId
    ? (ar ? "تحديث التطابق" : "Refresh Matches")
    : (ar ? "إعادة حساب الكل" : "Recalculate All");

  const icon = isLoading
    ? <RefreshCw size={13} className="animate-spin" />
    : isSuccess
    ? <CheckCircle2 size={13} className="text-green-600" />
    : isError
    ? <AlertCircle size={13} className="text-destructive" />
    : <RefreshCw size={13} className={showStale ? "text-amber-500" : ""} />;

  const buttonVariant = showStale ? "default" : variant;
  const buttonExtra   = showStale
    ? "bg-amber-500 hover:bg-amber-600 text-white border-0"
    : isSuccess
    ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-50"
    : isError
    ? "border-destructive/40 text-destructive"
    : "";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        <Button
          size={size}
          variant={buttonVariant}
          disabled={isLoading}
          onClick={() => recalculate({ job_id: jobId })}
          className={`gap-1.5 transition-all ${buttonExtra}`}
          title={showStale ? (ar ? "يوجد مرشحون جدد غير مطابقين" : "New candidates not yet matched") : undefined}
        >
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </Button>

        {showStale && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {ar ? "قديم" : "Outdated"}
          </span>
        )}
      </div>

      {showMeta && displayDate && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1 pl-0.5">
          <Clock size={9} />
          {ar ? "آخر تحديث:" : "Last updated:"}{" "}
          {relativeTime(displayDate, ar)}
        </p>
      )}
    </div>
  );
}

export default RefreshMatchesButton;
