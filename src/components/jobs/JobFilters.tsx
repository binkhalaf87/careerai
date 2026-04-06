import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

export interface JobFiltersState {
  datePosted: string;
  employmentType: string;
  remoteOnly: boolean;
  sortBy: string;
}

interface Props {
  filters: JobFiltersState;
  onChange: (filters: JobFiltersState) => void;
  ar: boolean;
}

export const DEFAULT_FILTERS: JobFiltersState = {
  datePosted: "all",
  employmentType: "",
  remoteOnly: false,
  sortBy: "relevance",
};

export function JobFilters({ filters, onChange, ar }: Props) {
  const [open, setOpen] = useState(false);
  const hasFilters =
    filters.datePosted !== "all" || filters.employmentType !== "" || filters.remoteOnly;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal size={13} />
          {ar ? "تصفية" : "Filters"}
          {hasFilters && (
            <Badge variant="default" className="h-4 w-4 p-0 flex items-center justify-center text-[9px] rounded-full">
              !
            </Badge>
          )}
        </Button>

        <Select
          value={filters.sortBy}
          onValueChange={(v) => onChange({ ...filters, sortBy: v })}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">{ar ? "الأكثر صلة" : "Best Match"}</SelectItem>
            <SelectItem value="date">{ar ? "الأحدث" : "Newest"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {open && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/40 rounded-lg border">
          <Select
            value={filters.datePosted}
            onValueChange={(v) => onChange({ ...filters, datePosted: v })}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder={ar ? "تاريخ النشر" : "Date Posted"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "الكل" : "All time"}</SelectItem>
              <SelectItem value="today">{ar ? "اليوم" : "Today"}</SelectItem>
              <SelectItem value="3days">{ar ? "3 أيام" : "3 days"}</SelectItem>
              <SelectItem value="week">{ar ? "أسبوع" : "Week"}</SelectItem>
              <SelectItem value="month">{ar ? "شهر" : "Month"}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.employmentType || "any"}
            onValueChange={(v) => onChange({ ...filters, employmentType: v === "any" ? "" : v })}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder={ar ? "نوع الوظيفة" : "Job Type"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{ar ? "الكل" : "All types"}</SelectItem>
              <SelectItem value="FULLTIME">{ar ? "دوام كامل" : "Full-time"}</SelectItem>
              <SelectItem value="PARTTIME">{ar ? "دوام جزئي" : "Part-time"}</SelectItem>
              <SelectItem value="CONTRACTOR">{ar ? "عقد" : "Contract"}</SelectItem>
              <SelectItem value="INTERN">{ar ? "تدريب" : "Internship"}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={filters.remoteOnly ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => onChange({ ...filters, remoteOnly: !filters.remoteOnly })}
          >
            {ar ? "عن بُعد" : "Remote Only"}
          </Button>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onChange(DEFAULT_FILTERS)}
            >
              <X size={12} className="mr-1" />
              {ar ? "مسح" : "Clear"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
