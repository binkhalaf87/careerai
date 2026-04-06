import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Loader2, ArrowUpDown, CalendarDays, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SortBy = "match_score" | "ats_score" | "date";

type SearchRow = {
  id: string;
  name: string;
  email: string | null;
  current_title: string | null;
  ats_score: number | null;
  fit_score: number | null;
  created_at: string;
  extracted_skills: string[] | null;
  extracted_text: string | null;
  snippet: string | null;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const safe = escapeRegExp(query.trim());
  return text.replace(new RegExp(`(${safe})`, "ig"), "<mark>$1</mark>");
}

export default function RecruiterSearch() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const ar = language === "ar";
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("match_score");
  const [rows, setRows] = useState<SearchRow[]>([]);

  const load = async (searchText: string, nextSortBy: SortBy) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("search_recruiter_candidates", {
        search_text: searchText || "",
        recruiter_uuid: user.id,
        limit_count: 100,
        offset_count: 0,
        sort_by: nextSortBy,
      });

      if (error) throw error;
      setRows((data || []) as SearchRow[]);
    } catch (err: any) {
      toast.error(err?.message || (ar ? "تعذر تحميل نتائج البحث" : "Failed to load search results"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(query, sortBy);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, sortBy, user]);

  const sortLabel = useMemo(
    () => ({
      match_score: ar ? "درجة التطابق / Match Score" : "Match Score / درجة التطابق",
      ats_score: ar ? "درجة ATS / ATS Score" : "ATS Score / درجة ATS",
      date: ar ? "التاريخ / Date" : "Date / التاريخ",
    }),
    [ar],
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{ar ? "بحث المرشحين / Candidate Search" : "Candidate Search / بحث المرشحين"}</h1>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "ابحث في الاسم والمهارات والخبرات والتعليم ونص السيرة والمسمى الوظيفي في مكان واحد."
              : "Search name, skills, experience, education, resume text, and job titles in one place."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={sortBy === "match_score" ? "default" : "outline"} size="sm" onClick={() => setSortBy("match_score")}>
            <Target className="h-4 w-4 mr-1.5" /> {sortLabel.match_score}
          </Button>
          <Button variant={sortBy === "ats_score" ? "default" : "outline"} size="sm" onClick={() => setSortBy("ats_score")}>
            <ArrowUpDown className="h-4 w-4 mr-1.5" /> {sortLabel.ats_score}
          </Button>
          <Button variant={sortBy === "date" ? "default" : "outline"} size="sm" onClick={() => setSortBy("date")}>
            <CalendarDays className="h-4 w-4 mr-1.5" /> {sortLabel.date}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            placeholder={ar ? "ابحث باسم المرشح أو المهارة أو الجامعة أو أي كلمة..." : "Search by name, skill, university, keyword..."}
          />
        </div>
      </Card>

      <div className="text-sm text-muted-foreground">
        {loading
          ? ar
            ? "جارٍ تحديث النتائج..."
            : "Refreshing results..."
          : ar
            ? `${rows.length} نتيجة`
            : `${rows.length} results`}
      </div>

      <div className="grid gap-4">
        {loading ? (
          <Card className="p-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </Card>
        ) : rows.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            {ar ? "لا توجد نتائج مطابقة حالياً." : "No matching candidates found right now."}
          </Card>
        ) : (
          rows.map((row) => (
            <Card key={row.id} className="p-4 space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1 min-w-0">
                  <Link to={`/recruiter/candidates/${row.id}`} className="text-base font-semibold text-primary hover:underline">
                    {row.name}
                  </Link>
                  <div className="text-sm text-muted-foreground">{row.current_title || (ar ? "بدون مسمى" : "No title")}</div>
                  {row.email ? <div className="text-xs text-muted-foreground">{row.email}</div> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{ar ? `التطابق ${Math.round(row.fit_score || 0)}%` : `Match ${Math.round(row.fit_score || 0)}%`}</Badge>
                  <Badge variant="outline">ATS {Math.round(row.ats_score || 0)}</Badge>
                </div>
              </div>

              {row.extracted_skills?.length ? (
                <div className="flex flex-wrap gap-2">
                  {row.extracted_skills.slice(0, 8).map((skill) => (
                    <Badge key={`${row.id}-${skill}`} variant="outline">{skill}</Badge>
                  ))}
                </div>
              ) : null}

              <div
                className="text-sm text-muted-foreground leading-6"
                dangerouslySetInnerHTML={{
                  __html: highlight(row.snippet || row.extracted_text || "", query),
                }}
              />
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
