import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Upload,
  UserPlus,
  Search,
  Loader2,
  FileText,
  FileSpreadsheet,
  Brain,
  AlertTriangle,
  Target,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  buildResumeUploadFormData,
  getReadableUploadErrorMessage,
  getSupabaseFunctionErrorMessage,
  validateResumeFile,
} from "@/hooks/useUserResume";
import { triggerMatchCalculation } from "@/hooks/useJobMatches";
import { generateAndPersistCandidateAnalysis } from "@/hooks/useCandidateAnalysis";
import { BulkResumeUploadDialog } from "@/components/recruiter/BulkResumeUploadDialog";

const PAGE_SIZE = 20;
const STAGES = [
  "all",
  "new",
  "under_review",
  "shortlisted",
  "interview_scheduled",
  "ai_interview_sent",
  "ai_interview_completed",
  "live_interview_scheduled",
  "rejected",
  "hired",
];

interface Candidate {
  id: string;
  name: string;
  email: string | null;
  current_title: string | null;
  experience_years: number | null;
  stage: string;
  fit_score: number | null;
  fit_label: string | null;
  ai_report?: any;
  latest_analysis_json?: any;
  latest_analysis_score?: number | null;
  latest_analysis_at?: string | null;
  created_at: string;
  file_path?: string | null;
  best_job_title?: string | null;
  best_job_score?: number | null;
}

// ─── Name helpers ──────────────────────────────────────────────────────────
function cleanName(raw: string): string {
  return raw
    .replace(/\b(cv|resume|curriculum vitae)\b/gi, "")
    .replace(/[_\-\.]+/g, " ")
    .replace(/[^a-zA-Z\u0600-\u06FF\s]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function extractCandidateName(c: { name?: string | null; ai_report?: any; email?: string | null }): string {
  const fromAI =
    c.ai_report?.name ||
    c.ai_report?.full_name ||
    c.ai_report?.candidate_name ||
    c.ai_report?.structured?.name ||
    c.ai_report?.structured?.full_name;
  if (fromAI && typeof fromAI === "string" && fromAI.trim().length > 1) return cleanName(fromAI);
  if (c.name && c.name.trim().length > 1) {
    const cl = cleanName(c.name);
    if (cl.length > 1) return cl;
  }
  if (c.email) return cleanName(c.email.split("@")[0]);
  return "Unknown Candidate";
}

// ─── Score color helpers ───────────────────────────────────────────────────
function fitColor(score: number | null) {
  if (!score) return "text-muted-foreground";
  if (score >= 80) return "text-green-600 font-bold";
  if (score >= 60) return "text-blue-600 font-bold";
  if (score >= 40) return "text-yellow-600 font-bold";
  return "text-red-500 font-bold";
}
function bestMatchBadgeCls(score: number | null) {
  if (score == null) return "bg-muted text-muted-foreground border-border";
  if (score >= 80) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 60) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-700 border-red-200";
}
function stageBadge(stage: string) {
  const map: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    under_review: "bg-yellow-100 text-yellow-700",
    shortlisted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    hired: "bg-emerald-100 text-emerald-700",
    interview_scheduled: "bg-purple-100 text-purple-700",
    ai_interview_sent: "bg-indigo-100 text-indigo-700",
    ai_interview_completed: "bg-violet-100 text-violet-700",
    live_interview_scheduled: "bg-orange-100 text-orange-700",
  };
  return map[stage] || "bg-muted text-muted-foreground";
}
function toArray(value: any): string[] {
  if (Array.isArray(value)) return value.map((i) => String(i || "").trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}
function normalizeSkills(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[;,\n•·|]/) : [];

  return [
    ...new Set(
      items
        .map((item) =>
          String(item || "")
            .trim()
            .toLowerCase(),
        )
        .map((item) => item.replace(/^[-•*]+\s*/, ""))
        .filter(Boolean),
    ),
  ];
}

function extractExperienceYears(structured: Record<string, any>, rawText: string): number | null {
  const directKeys = [
    "experience_years",
    "years_of_experience",
    "total_experience_years",
    "experience",
    "yearsExperience",
  ];

  for (const key of directKeys) {
    const value = structured?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value.replace(/[^\d.]/g, ""));
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }

  const mergedText = [structured?.summary, structured?.experience, rawText].filter(Boolean).join(" \n ");
  const patterns = [/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b/i, /(\d+(?:\.\d+)?)\s*\+?\s*(?:سنوات|سنه|سنة)\b/i];
  for (const pattern of patterns) {
    const match = mergedText.match(pattern);
    if (match) {
      const parsed = parseFloat(match[1]);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

function getExperienceLabel(years: number | null) {
  if (years == null) return "Not specified";
  if (years < 2) return `Junior (${years}y)`;
  if (years < 6) return `Mid-Level (${years}y)`;
  return `Senior (${years}y)`;
}
const stageLabel = (s: string) => s.replace(/_/g, " ");

// ─── Component ─────────────────────────────────────────────────────────────
const RecruiterCandidates = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ar = language === "ar";

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState(searchParams.get("stage") || "all");
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(searchParams.get("action") === "upload");
  const [addOpen, setAddOpen] = useState(searchParams.get("action") === "add");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [addForm, setAddForm] = useState({ name: "", email: "", current_title: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const [stageUpdatingId, setStageUpdatingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewCandidate, setViewCandidate] = useState<Candidate | null>(null);

  const loadCandidates = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("recruiter_candidates")
      .select(
        "id, name, email, current_title, experience_years, stage, fit_score, fit_label, ai_report, latest_analysis_json, latest_analysis_score, latest_analysis_at, created_at, file_path",
      )
      .eq("recruiter_id", user.id)
      .order("created_at", { ascending: false });
    if (stageFilter !== "all") query = query.eq("stage", stageFilter);
    const { data } = await query.limit(500);
    const raw = (data || []) as Candidate[];

    // Fetch best job match per candidate
    const ids = raw.map((c) => c.id);
    let matchMap: Record<string, { title: string; score: number }> = {};
    if (ids.length > 0) {
      const { data: mData } = await (supabase as any)
        .from("recruiter_candidate_job_matches")
        .select("candidate_id, match_score, recruiter_jobs!inner(title)")
        .in("candidate_id", ids)
        .order("match_score", { ascending: false })
        .limit(ids.length * 3);
      (mData || []).forEach((m: any) => {
        if (!matchMap[m.candidate_id] || m.match_score > matchMap[m.candidate_id].score)
          matchMap[m.candidate_id] = { title: m.recruiter_jobs?.title || "", score: m.match_score };
      });
    }

    setCandidates(
      raw.map((c) => ({
        ...c,
        name: extractCandidateName(c),
        best_job_title: matchMap[c.id]?.title || null,
        best_job_score: matchMap[c.id]?.score ?? null,
      })),
    );
    setLoading(false);
  }, [user, stageFilter]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);
  useEffect(() => {
    setPage(1);
  }, [search, stageFilter]);

  const filtered = candidates.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.current_title || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ─── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirmId || !user) return;
    setDeleting(true);
    const target = candidates.find((c) => c.id === deleteConfirmId);
    setCandidates((prev) => prev.filter((c) => c.id !== deleteConfirmId));
    setDeleteConfirmId(null);
    try {
      if (target?.file_path) await supabase.storage.from("resumes").remove([target.file_path]);
      await (supabase as any).from("recruiter_candidate_job_matches").delete().eq("candidate_id", deleteConfirmId);
      const { error } = await supabase
        .from("recruiter_candidates")
        .delete()
        .eq("id", deleteConfirmId)
        .eq("recruiter_id", user.id);
      if (error) throw error;
      toast.success(ar ? "تم حذف المرشح" : "Candidate deleted");
    } catch (err: any) {
      toast.error(err?.message || "Delete failed");
      loadCandidates();
    } finally {
      setDeleting(false);
    }
  };

  // ─── Upload ──────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    let filePath = "";
    setUploadProgress(0);
    setUploading(true);
    try {
      const { mimeType } = validateResumeFile(file);
      setUploadProgress(12);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const candidateId = crypto.randomUUID();
      filePath = `recruiter/${user.id}/candidates/${candidateId}/${Date.now()}_${safeName}`;
      const { error: storageErr } = await supabase.storage
        .from("resumes")
        .upload(filePath, file, { cacheControl: "3600", upsert: false, contentType: mimeType });
      if (storageErr) throw new Error(storageErr.message || "Storage upload failed");
      setUploadProgress(45);
      const formData = buildResumeUploadFormData(file, mimeType);
      setUploadProgress(58);
      const { data: extractData, error: extractErr } = await supabase.functions.invoke("extract-text", {
        body: formData,
      });
      if (extractErr) throw new Error(await getSupabaseFunctionErrorMessage(extractErr, "Text extraction failed"));
      if (extractData?.error)
        throw new Error(String(extractData?.message || extractData?.error || "Text extraction failed"));
      setUploadProgress(78);
      const rawText = String(extractData?.text || "");
      const structured = (extractData?.structured || {}) as Record<string, any>;
      const extractedSkills = normalizeSkills(
        structured.skills || structured.key_skills || structured.technical_skills,
      );
      const extractedExperienceYears = extractExperienceYears(structured, rawText);
      const fallbackEmail =
        String(structured.email || structured.contact_info || structured.contact || rawText || "").match(
          /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/,
        )?.[0] || null;
      const rawName =
        structured.full_name || structured.name || structured.candidate_name || file.name.replace(/\.[^.]+$/, "");
      const name = cleanName(rawName);
      const { data: inserted, error: insertErr } = await supabase
        .from("recruiter_candidates")
        .insert({
          recruiter_id: user.id,
          name,
          email: structured.email || fallbackEmail,
          current_title: structured.job_title || null,
          file_name: file.name,
          file_path: filePath,
          extracted_text: rawText,
          structured_data: structured,
          extracted_skills: extractedSkills,
          extracted_experience_years: extractedExperienceYears,
          experience_years: extractedExperienceYears,
          stage: "new",
        })
        .select("id")
        .single();
      if (insertErr) throw new Error(insertErr.message || "Failed to create candidate");
      setUploadProgress(100);
      toast.success(ar ? "تم رفع المرشح بنجاح" : "Candidate uploaded successfully");
      setUploadOpen(false);
      loadCandidates();
      if (inserted) {
        if (rawText.trim()) {
          try {
            await generateAndPersistCandidateAnalysis({
              candidateId: inserted.id,
              recruiterId: user.id,
              resumeId: filePath,
              candidateText: rawText,
              candidateName: name,
              candidateTitle: structured.job_title || null,
              language,
              analysisType: "single_upload",
            });
          } catch {}
        }
        await triggerMatchCalculation({ candidate_id: inserted.id });
        navigate(`/recruiter/candidates/${inserted.id}`);
      }
    } catch (err: any) {
      if (filePath) {
        try {
          await supabase.storage.from("resumes").remove([filePath]);
        } catch {}
      }
      toast.error(getReadableUploadErrorMessage(err?.message, ar ? "ar" : "en"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setExcelUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[workbook.SheetNames[0]]);
      if (!rows.length) {
        toast.error(ar ? "الملف فارغ" : "File is empty");
        return;
      }
      const toInsert = rows
        .map((row) => ({
          recruiter_id: user.id,
          name: cleanName(
            String(row["Name"] || row["name"] || row["الاسم"] || row["Full Name"] || row["full_name"] || "").trim(),
          ),
          email:
            row["Email"] || row["email"] || row["البريد"] || null
              ? String(row["Email"] || row["email"] || row["البريد"]).trim()
              : null,
          phone:
            row["Phone"] || row["phone"] || row["الهاتف"] || null
              ? String(row["Phone"] || row["phone"] || row["الهاتف"]).trim()
              : null,
          current_title:
            row["Title"] || row["title"] || row["المسمى"] || null
              ? String(row["Title"] || row["title"] || row["المسمى"]).trim()
              : null,
          experience_years: parseFloat(String(row["Experience"] || row["experience"] || row["الخبرة"] || "0")) || null,
          stage: "new" as const,
        }))
        .filter((c) => c.name && c.name.length > 1);
      if (!toInsert.length) {
        toast.error(ar ? "لم يتم العثور على بيانات صالحة" : "No valid data found");
        return;
      }
      const { error } = await supabase.from("recruiter_candidates").insert(toInsert);
      if (error) throw error;
      await triggerMatchCalculation({ incremental: false });
      toast.success(ar ? `تم إضافة ${toInsert.length} مرشح` : `${toInsert.length} candidates added`);
      setExcelOpen(false);
      loadCandidates();
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setExcelUploading(false);
    }
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !addForm.name.trim()) return;
    setAddSaving(true);
    const { data, error } = await supabase
      .from("recruiter_candidates")
      .insert({
        recruiter_id: user.id,
        name: cleanName(addForm.name.trim()),
        email: addForm.email.trim() || null,
        current_title: addForm.current_title.trim() || null,
        stage: "new",
      })
      .select("id")
      .single();
    setAddSaving(false);
    if (error) {
      toast.error("Failed to add");
      return;
    }
    toast.success(ar ? "تمت الإضافة" : "Candidate added");
    setAddOpen(false);
    setAddForm({ name: "", email: "", current_title: "" });
    loadCandidates();
    if (data) {
      await triggerMatchCalculation({ candidate_id: data.id });
      navigate(`/recruiter/candidates/${data.id}`);
    }
  };

  const updateStage = async (candidateId: string, stage: string) => {
    try {
      setStageUpdatingId(candidateId);
      const { error } = await supabase.from("recruiter_candidates").update({ stage }).eq("id", candidateId);
      if (error) throw error;
      setCandidates((prev) => prev.map((c) => (c.id === candidateId ? { ...c, stage } : c)));
      toast.success(ar ? "تم تحديث المرحلة" : "Stage updated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update stage");
    } finally {
      setStageUpdatingId(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">{ar ? "المرشحون" : "Candidates"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ar ? "عرض سريع يساعد على الفرز واتخاذ القرار" : "Recruiter-friendly view for faster decisions"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload size={14} className="mr-1.5" />
            {ar ? "رفع سيرة" : "Upload CV"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulkUploadOpen(true)}>
            <Upload size={14} className="mr-1.5" />
            {ar ? "رفع متعدد" : "Upload Multiple CVs"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExcelOpen(true)}>
            <FileSpreadsheet size={14} className="mr-1.5" />
            {ar ? "استيراد Excel" : "Import Excel"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <UserPlus size={14} className="mr-1.5" />
            {ar ? "إضافة يدوية" : "Add Manually"}
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && candidates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: ar ? "الكل" : "All", count: candidates.length },
            { key: "new", label: ar ? "جديد" : "New", count: candidates.filter((c) => c.stage === "new").length },
            {
              key: "shortlisted",
              label: ar ? "مختار" : "Shortlisted",
              count: candidates.filter((c) => c.stage === "shortlisted").length,
            },
            {
              key: "rejected",
              label: ar ? "مرفوض" : "Rejected",
              count: candidates.filter((c) => c.stage === "rejected").length,
            },
          ].map((stat) => (
            <button
              key={stat.key}
              onClick={() => setStageFilter(stat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${stageFilter === stat.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}
            >
              <span>{stat.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${stageFilter === stat.key ? "bg-white/20" : "bg-muted"}`}
              >
                {stat.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={ar ? "بحث بالاسم أو الوظيفة أو الإيميل..." : "Search by name, title, or email..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[190px] bg-card">
            <SelectValue placeholder={ar ? "المرحلة" : "Stage"} />
          </SelectTrigger>
          <SelectContent>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? (ar ? "الكل" : "All Stages") : stageLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Candidate list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-body">
            {ar ? "لا يوجد مرشحون. ارفع سيرة ذاتية للبدء." : "No candidates found. Upload a CV to get started."}
          </p>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((c) => {
              const risks = toArray(c.ai_report?.risks || c.ai_report?.concerns || c.ai_report?.red_flags).slice(0, 2);
              const strengths = toArray(c.ai_report?.strengths || c.ai_report?.top_strengths).slice(0, 2);
              const summary =
                c.ai_report?.summary || c.ai_report?.experience_summary || c.ai_report?.profile_summary || null;
              return (
                <Card
                  key={c.id}
                  className="p-0 overflow-hidden border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-border">
                    {/* LEFT: Info */}
                    <div className="p-4 flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">
                          {c.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            className="text-start font-semibold text-foreground hover:text-primary transition-colors"
                            onClick={() => setViewCandidate(c)}
                          >
                            {c.name}
                          </button>
                          <Badge className={`text-[10px] ${stageBadge(c.stage)}`}>{stageLabel(c.stage)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{c.current_title || "—"}</p>
                        <p className="text-xs text-muted-foreground">{c.email || ""}</p>
                        {summary && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{summary}</p>
                        )}
                        {c.best_job_title && c.best_job_score != null && (
                          <div className="mt-2">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${bestMatchBadgeCls(c.best_job_score)}`}
                            >
                              <Target size={9} />
                              {ar ? "أفضل وظيفة:" : "Best Match:"} {c.best_job_title} — {c.best_job_score}%
                            </span>
                          </div>
                        )}
                        {!c.best_job_title && (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {ar ? "بانتظار إتمام المطابقة مع الوظائف" : "Awaiting job matching"}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* MIDDLE: AI Insights */}
                    <div className="p-4 space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Brain size={11} /> AI Insights
                      </p>
                      {strengths.length > 0 ? (
                        <div className="space-y-1">
                          {strengths.map((s, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <CheckCircle2 size={12} className="text-green-500 mt-0.5 shrink-0" />
                              <span className="text-xs text-foreground line-clamp-2">{s}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">{ar ? "بانتظار التحليل" : "Awaiting analysis"}</p>
                      )}
                      {risks.length > 0 && (
                        <div className="space-y-1 mt-2">
                          {risks.map((r, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                              <span className="text-xs text-muted-foreground line-clamp-2">{r}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* RIGHT: Actions */}
                    <div className="p-4 flex flex-col gap-2 justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => setViewCandidate(c)}
                      >
                        <FileText size={13} className="mr-1.5" />
                        {ar ? "عرض سريع" : "View Profile"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full justify-start"
                        onClick={() => updateStage(c.id, "shortlisted")}
                        disabled={stageUpdatingId === c.id}
                      >
                        {stageUpdatingId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <CheckCircle2 size={13} className="mr-1.5" />
                        )}
                        {ar ? "اختيار" : "Shortlist"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full justify-start"
                        onClick={() => updateStage(c.id, "rejected")}
                        disabled={stageUpdatingId === c.id}
                      >
                        <XCircle size={13} className="mr-1.5" />
                        {ar ? "رفض" : "Reject"}
                      </Button>
                      <Button
                        size="sm"
                        className="w-full justify-start"
                        onClick={() =>
                          navigate(`/recruiter/questions?candidate=${c.id}&name=${encodeURIComponent(c.name)}`)
                        }
                      >
                        <Brain size={13} className="mr-1.5" />
                        {ar ? "مقابلة AI" : "AI Interview"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteConfirmId(c.id)}
                      >
                        <Trash2 size={13} className="mr-1.5" />
                        {ar ? "حذف" : "Delete"}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 size={16} />
              {ar ? "حذف المرشح" : "Delete Candidate"}
            </DialogTitle>
            <DialogDescription>
              {ar
                ? "هل أنت متأكد من حذف هذا المرشح؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this candidate? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={deleting}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 size={14} className="mr-2" />}
              {ar ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick View Modal */}
      <Dialog open={!!viewCandidate} onOpenChange={() => setViewCandidate(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {viewCandidate && (
            <>
              <DialogHeader>
                <DialogTitle>{viewCandidate.name}</DialogTitle>
                <DialogDescription>{viewCandidate.current_title || "—"}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{ar ? "البريد" : "Email"}</p>
                    <p className="font-medium">{viewCandidate.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{ar ? "الخبرة" : "Experience"}</p>
                    <p className="font-medium">{getExperienceLabel(viewCandidate.experience_years)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{ar ? "المرحلة" : "Stage"}</p>
                    <Badge className={`text-[10px] ${stageBadge(viewCandidate.stage)}`}>
                      {stageLabel(viewCandidate.stage)}
                    </Badge>
                  </div>
                  {viewCandidate.best_job_score != null && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">{ar ? "أفضل توافق" : "Best Match"}</p>
                      <span className={`text-sm font-bold ${fitColor(viewCandidate.best_job_score)}`}>
                        {viewCandidate.best_job_title} — {viewCandidate.best_job_score}%
                      </span>
                    </div>
                  )}
                </div>
                {(viewCandidate.latest_analysis_json || viewCandidate.ai_report)?.summary && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{ar ? "الملخص" : "Summary"}</p>
                    <p className="text-sm leading-relaxed">
                      {(viewCandidate.latest_analysis_json || viewCandidate.ai_report).summary}
                    </p>
                  </div>
                )}
                {toArray(
                  (viewCandidate.latest_analysis_json || viewCandidate.ai_report)?.strengths ||
                    (viewCandidate.latest_analysis_json || viewCandidate.ai_report)?.top_strengths,
                ).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                      ✅ {ar ? "نقاط القوة" : "Key Strengths"}
                    </p>
                    <ul className="space-y-1">
                      {toArray(
                        (viewCandidate.latest_analysis_json || viewCandidate.ai_report)?.strengths ||
                          (viewCandidate.latest_analysis_json || viewCandidate.ai_report)?.top_strengths,
                      )
                        .slice(0, 4)
                        .map((s, i) => (
                          <li key={i} className="text-sm flex items-start gap-1.5">
                            <span className="text-green-500 mt-0.5">•</span>
                            {s}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                {toArray(
                  (viewCandidate.latest_analysis_json || viewCandidate.ai_report)?.risks ||
                    (viewCandidate.latest_analysis_json || viewCandidate.ai_report)?.red_flags,
                ).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">⚠️ {ar ? "مخاطر" : "Risks"}</p>
                    <ul className="space-y-1">
                      {toArray(
                        (viewCandidate.latest_analysis_json || viewCandidate.ai_report)?.risks ||
                          (viewCandidate.latest_analysis_json || viewCandidate.ai_report)?.red_flags,
                      )
                        .slice(0, 4)
                        .map((r, i) => (
                          <li key={i} className="text-sm flex items-start gap-1.5">
                            <span className="text-amber-500 mt-0.5">•</span>
                            {r}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewCandidate(null);
                    navigate(`/recruiter/candidates/${viewCandidate.id}`);
                  }}
                >
                  {ar ? "الملف الكامل" : "Full Profile"}
                </Button>
                <Button
                  onClick={() => {
                    setViewCandidate(null);
                    navigate(
                      `/recruiter/questions?candidate=${viewCandidate.id}&name=${encodeURIComponent(viewCandidate.name)}`,
                    );
                  }}
                >
                  <Brain size={14} className="mr-1.5" />
                  {ar ? "مقابلة AI" : "AI Interview"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <BulkResumeUploadDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        recruiterId={user?.id || ""}
        language={ar ? "ar" : "en"}
        onCompleted={async () => {
          await loadCandidates();
          setBulkUploadOpen(false);
        }}
      />

      {/* Upload CV */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ar ? "رفع سيرة ذاتية" : "Upload Candidate CV"}</DialogTitle>
            <DialogDescription>{ar ? "ارفع ملف PDF أو DOCX" : "Upload a PDF or DOCX file"}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors">
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              )}
              <span className="text-sm text-muted-foreground font-body">
                {uploading
                  ? ar
                    ? `جاري الرفع... ${uploadProgress}%`
                    : `Uploading... ${uploadProgress}%`
                  : ar
                    ? "اختر ملف"
                    : "Choose file"}
              </span>
              {uploading && (
                <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
              <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Manually */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ar ? "إضافة مرشح" : "Add Candidate"}</DialogTitle>
            <DialogDescription>
              {ar ? "أدخل بيانات المرشح يدوياً" : "Enter candidate details manually"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder={ar ? "الاسم *" : "Full Name *"}
              value={addForm.name}
              onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
              className="bg-card"
            />
            <Input
              type="email"
              placeholder={ar ? "البريد الإلكتروني" : "Email"}
              value={addForm.email}
              onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
              className="bg-card"
            />
            <Input
              placeholder={ar ? "المسمى الوظيفي الحالي" : "Current Title"}
              value={addForm.current_title}
              onChange={(e) => setAddForm((p) => ({ ...p, current_title: e.target.value }))}
              className="bg-card"
            />
            <Button className="w-full" disabled={addSaving} onClick={handleAddManual}>
              {addSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {ar ? "إضافة" : "Add Candidate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Excel */}
      <Dialog open={excelOpen} onOpenChange={setExcelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ar ? "استيراد من Excel" : "Import from Excel"}</DialogTitle>
            <DialogDescription>
              {ar
                ? "ارفع ملف Excel يحتوي على أعمدة: الاسم، البريد، الهاتف، المسمى، سنوات الخبرة"
                : "Upload an Excel file with columns: Name, Email, Phone, Title, Experience"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors">
              {excelUploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              ) : (
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground mb-2" />
              )}
              <span className="text-sm text-muted-foreground font-body">
                {excelUploading
                  ? ar
                    ? "جاري الاستيراد..."
                    : "Importing..."
                  : ar
                    ? "اختر ملف Excel"
                    : "Choose Excel file"}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleExcelUpload}
                disabled={excelUploading}
              />
            </label>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold">{ar ? "الأعمدة المدعومة:" : "Supported columns:"}</p>
              <p>Name / الاسم, Email / البريد, Phone / الهاتف, Title / المسمى, Experience / الخبرة</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecruiterCandidates;
