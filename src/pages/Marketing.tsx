/**
 * Smart Send — formerly "Resume Marketing"
 *
 * ROUTE:    /marketing  (unchanged)
 * BACKEND:  gmail-auth, gmail-send, generate-email (all unchanged)
 * DB:       gmail_tokens, resumes, generated_resumes, marketing_emails,
 *           point_transactions, profiles, companies (all existing columns only)
 *
 * CHANGES vs old page:
 *  - Title / language: "Resume Marketing" → "Smart Send"
 *  - Resume selection: boring dropdown → visual resume cards (Step 1)
 *  - Outreach Goal selector: new UI state — influences generate-email prompt (Step 2)
 *  - Email builder: cleaner section card layout + preview/edit toggle (Step 3)
 *  - Company targeting: same logic, improved layout (Step 4)
 *  - Send Review panel: pre-send checklist shown before bulk send
 *  - Tracker tab: unchanged logic, minor style polish
 *
 * INTENTIONAL OMISSIONS (no hallucination):
 *  - No ATS score (not reliably on resumes table)
 *  - No scheduling (no backend support)
 *  - No open/reply-rate analytics (not in existing schema)
 *  - No CSV upload (was not in original page)
 *  - No new DB tables or columns
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Sparkles,
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Paperclip,
  LogOut,
  Wand2,
  Building2,
  Coins,
  Search,
  Clock,
  ChevronDown,
  AlertCircle,
  FileText,
  Eye,
  EyeOff,
  Target,
  Briefcase,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SERVICE_COSTS, deductPoints } from "@/lib/points";

// ─── Types ───────────────────────────────────────────────
interface ResumeOption {
  id: string;
  file_name: string;
  type: "uploaded" | "generated";
  updated_at?: string;
}
interface CompanyItem {
  id: string;
  name: string;
  email: string | null;
  industry: string | null;
}
interface SentRecord {
  id: string;
  company_name: string;
  recipient_email: string;
  subject: string;
  created_at: string;
  gmail_status: string;
}

// ─── Constants ────────────────────────────────────────────
const COMPANY_COUNT_OPTIONS = [10, 25, 50, 100];
const POINTS_PER_100 = SERVICE_COSTS.marketing_per_100;
const calcCost = (count: number) => Math.ceil((count / 100) * POINTS_PER_100);

const OUTREACH_GOALS = [
  { id: "application", icon: Briefcase, labelEn: "Job Application", labelAr: "تقديم وظيفة" },
  { id: "cold", icon: Target, labelEn: "Cold Outreach", labelAr: "تواصل مبادر" },
  { id: "followup", icon: RefreshCw, labelEn: "Follow-up", labelAr: "متابعة" },
] as const;
type OutreachGoal = (typeof OUTREACH_GOALS)[number]["id"];

const DEFAULT_SUBJECT = "Application for Joining Your Team – {jobTitle}";
const DEFAULT_SUBJECT_AR = "طلب انضمام إلى فريقكم – {jobTitle}";

const DEFAULT_BODY = `Dear Hiring Team at {company},

I hope this message finds you well. I am writing to express my strong interest in joining {company} and contributing to your team's success.

With a background in {industry}, I bring a combination of technical expertise and a results-driven mindset that aligns with the values and goals of forward-thinking organizations like yours.

I would welcome the opportunity to discuss how my skills and experience can add value to your team. I have attached my resume for your review and would be happy to connect at your convenience.

Thank you for considering my application. I look forward to hearing from you.

Best regards,`;

const DEFAULT_BODY_AR = `السادة في شركة {company}،

تحية طيبة،

أتقدم إليكم بهذه الرسالة للتعبير عن اهتمامي الكبير بالانضمام إلى {company} والمساهمة في نجاح فريقكم.

بخلفيتي في مجال {industry}، أمتلك مزيجًا من الكفاءة التقنية والتوجه نحو النتائج الذي يتوافق مع قيم وأهداف المؤسسات الرائدة مثل مؤسستكم.

يسعدني مناقشة كيف يمكن لمهاراتي وخبرتي إضافة قيمة لفريقكم. أرفق سيرتي الذاتية للمراجعة وأنا سعيد بالتواصل في أي وقت يناسبكم.

شكرًا لكم على النظر في طلبي، وأتطلع إلى الاستماع منكم.

مع خالص التقدير،`;

// ─── Shared mini-components ──────────────────────────────
const StatusBadge = ({ status, ar }: { status: string; ar: boolean }) => {
  const isSent = status === "sent" || status === "sending";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold
      ${isSent ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
    >
      {isSent ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
      {isSent ? (ar ? "مُرسَل" : "Sent") : ar ? "محفوظ" : "Saved"}
    </span>
  );
};

// ══════════════════════════════════════════════
//  SMART SEND PAGE  (replaces Marketing)
// ══════════════════════════════════════════════
const Marketing = () => {
  const { user } = useAuth();
  const { t, language: uiLang } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const ar = uiLang === "ar";

  // Gmail
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);

  // Resume
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(
    searchParams.get("resume_id") || searchParams.get("id") || null,
  );
  const [selectedResumeType, setSelectedResumeType] = useState<"uploaded" | "generated">("uploaded");

  // Outreach goal
  const [outreachGoal, setOutreachGoal] = useState<OutreachGoal>("application");

  // Email compose
  const [emailSubject, setEmailSubject] = useState(ar ? DEFAULT_SUBJECT_AR : DEFAULT_SUBJECT);
  const [emailBody, setEmailBody] = useState(ar ? DEFAULT_BODY_AR : DEFAULT_BODY);
  const [previewMode, setPreviewMode] = useState(false);

  // AI settings
  const [jobTitle, setJobTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [emailLang, setEmailLang] = useState<string>(uiLang);
  const [tone, setTone] = useState("formal");
  const [showAiSettings, setShowAiSettings] = useState(false);

  // Companies
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [companyCount, setCompanyCount] = useState(10);
  const [companySearch, setCompanySearch] = useState("");
  const [userPoints, setUserPoints] = useState(0);

  // Review + send
  const [showReview, setShowReview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [improvingSubject, setImprovingSubject] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 });

  // Tracker
  const [sentRecords, setSentRecords] = useState<SentRecord[]>([]);
  const [trackerSearch, setTrackerSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"compose" | "tracker">("compose");

  // ── Derived ──
  const selectedResume = useMemo(
    () => resumes.find((r) => r.id === selectedResumeId) || null,
    [resumes, selectedResumeId],
  );

  const filteredCompanies = useMemo(() => {
    let list = companies.filter((c) => c.email);
    if (companySearch.trim()) {
      const q = companySearch.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.industry || "").toLowerCase().includes(q));
    }
    return list;
  }, [companies, companySearch]);

  const selectedCompanies = useMemo(() => filteredCompanies.slice(0, companyCount), [filteredCompanies, companyCount]);
  const estimatedCost = calcCost(selectedCompanies.length);
  const canAfford = userPoints >= estimatedCost;

  const filteredSentRecords = useMemo(() => {
    if (!trackerSearch.trim()) return sentRecords;
    const q = trackerSearch.toLowerCase();
    return sentRecords.filter(
      (r) => r.company_name.toLowerCase().includes(q) || r.recipient_email.toLowerCase().includes(q),
    );
  }, [sentRecords, trackerSearch]);

  const sentCount = sentRecords.filter((r) => r.gmail_status === "sent" || r.gmail_status === "sending").length;

  const canSend =
    gmailConnected &&
    !sendingBulk &&
    selectedCompanies.length > 0 &&
    canAfford &&
    emailSubject.trim().length > 0 &&
    emailBody.trim().length > 0;

  // ── Loaders ──
  const checkGmailStatus = useCallback(async () => {
    if (!user) {
      setGmailConnected(false);
      setGmailEmail(null);
      setGmailLoading(false);
      return;
    }
    setGmailLoading(true);
    try {
      const { data, error } = await supabase
        .from("gmail_tokens")
        .select("gmail_email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data && !error) {
        setGmailConnected(true);
        setGmailEmail(data.gmail_email);
      } else {
        setGmailConnected(false);
        setGmailEmail(null);
      }
    } catch {
      setGmailConnected(false);
      setGmailEmail(null);
    } finally {
      setGmailLoading(false);
    }
  }, [user]);

  const loadResumes = useCallback(async () => {
    if (!user) return;
    const [{ data: uploaded }, { data: generated }] = await Promise.all([
      supabase
        .from("resumes")
        .select("id, file_name, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("generated_resumes")
        .select("id, title, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    const list: ResumeOption[] = [
      ...(uploaded || []).map((r) => ({
        id: r.id,
        file_name: r.file_name,
        type: "uploaded" as const,
        updated_at: r.updated_at,
      })),
      ...(generated || []).map((r) => ({
        id: r.id,
        file_name: r.title,
        type: "generated" as const,
        updated_at: r.updated_at,
      })),
    ];
    setResumes(list);
    if (!selectedResumeId && list.length > 0) {
      setSelectedResumeId(list[0].id);
      setSelectedResumeType(list[0].type);
    }
  }, [user, selectedResumeId]);

  const loadCompanies = useCallback(async () => {
    const { data } = await supabase.from("companies").select("id, name, email, industry").order("name");
    if (data) setCompanies(data);
  }, []);

  const loadUserPoints = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("point_transactions").select("amount").eq("user_id", user.id);
    if (data) setUserPoints(data.reduce((s, tx) => s + tx.amount, 0));
  }, [user]);

  const loadSentRecords = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("marketing_emails")
      .select("id, company_name, recipient_email, subject, created_at, gmail_status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setSentRecords(data as SentRecord[]);
  }, [user]);

  useEffect(() => {
    checkGmailStatus();
  }, [checkGmailStatus]);
  useEffect(() => {
    loadResumes();
  }, [loadResumes]);
  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);
  useEffect(() => {
    loadUserPoints();
  }, [loadUserPoints]);
  useEffect(() => {
    loadSentRecords();
  }, [loadSentRecords]);

  useEffect(() => {
    const gp = searchParams.get("gmail");
    if (gp === "connected") {
      toast.success(t.marketing.gmailConnected);
      checkGmailStatus();
      const n = new URLSearchParams(searchParams);
      n.delete("gmail");
      setSearchParams(n, { replace: true });
    } else if (gp === "error") {
      toast.error(searchParams.get("msg") || t.marketing.gmailError);
      const n = new URLSearchParams(searchParams);
      n.delete("gmail");
      n.delete("msg");
      setSearchParams(n, { replace: true });
    }
  }, [searchParams, setSearchParams, t, checkGmailStatus]);

  // ── Gmail handlers ──
  const handleConnectGmail = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("gmail-auth", {
        body: { redirectUri: window.location.href.split("?")[0] },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err?.message || t.marketing.gmailError);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!user) return;
    try {
      await supabase.from("gmail_tokens").delete().eq("user_id", user.id);
      setGmailConnected(false);
      setGmailEmail(null);
      toast.success(ar ? "تم قطع اتصال Gmail" : "Gmail disconnected");
    } catch {
      toast.error(t.marketing.gmailError);
    }
  };

  // ── Resume context helpers (unchanged) ──
  const loadResumeContext = async () => {
    if (!selectedResumeId) return "";
    if (selectedResumeType === "uploaded") {
      const { data } = await supabase.from("resumes").select("extracted_text").eq("id", selectedResumeId).single();
      return data?.extracted_text ? `\n\nCandidate's resume:\n${data.extracted_text.substring(0, 2000)}` : "";
    }
    const { data } = await supabase.from("generated_resumes").select("content").eq("id", selectedResumeId).single();
    return data?.content ? `\n\nCandidate's resume data:\n${JSON.stringify(data.content).substring(0, 2000)}` : "";
  };

  const loadProfileContext = async () => {
    if (!user) return "";
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email, phone")
      .eq("user_id", user.id)
      .single();
    if (!profile) return "";
    return `\nCandidate name: ${profile.display_name || "N/A"}\nCandidate email: ${profile.email || "N/A"}${profile.phone ? `\nPhone: ${profile.phone}` : ""}`;
  };

  // Goal → extra context string sent to generate-email
  const goalContext = (goal: OutreachGoal) =>
    ({
      application: "This is a formal job application email.",
      cold: "This is a cold outreach email to introduce the candidate proactively.",
      followup: "This is a polite follow-up email to check on a previous application or conversation.",
    })[goal];

  // ── AI Generate ──
  const handleGenerateEmail = async () => {
    if (!selectedResumeId) {
      toast.error(t.marketing.selectResumeFirst);
      return;
    }
    if (!user) return;
    setGenerating(true);
    try {
      const [resumeContext, profileContext] = await Promise.all([loadResumeContext(), loadProfileContext()]);
      const { data, error } = await supabase.functions.invoke("generate-email", {
        body: {
          jobTitle: jobTitle || "General Application",
          industry: industry || "General",
          language: emailLang,
          tone,
          resumeContext: `${goalContext(outreachGoal)}${resumeContext}`,
          profileContext,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEmailSubject(data.subject || "");
      setEmailBody(data.body + (data.signature ? `\n\n${data.signature}` : ""));
      toast.success(ar ? "✓ تم إنشاء الرسالة" : "✓ Email generated");
    } catch (err: any) {
      toast.error(err?.message || t.common.error);
    } finally {
      setGenerating(false);
    }
  };

  const handleImproveSubject = async () => {
    if (!emailSubject.trim()) return;
    setImprovingSubject(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-email", {
        body: {
          jobTitle: jobTitle || "General Application",
          industry: industry || "General",
          language: emailLang,
          tone,
          resumeContext: `Current subject to improve: ${emailSubject}`,
          profileContext: "",
        },
      });
      if (error) throw error;
      if (data?.subject) setEmailSubject(data.subject);
    } catch (err: any) {
      toast.error(err?.message || t.common.error);
    } finally {
      setImprovingSubject(false);
    }
  };

  // ── Bulk Send (unchanged backend flow) ──
  const handleBulkSend = async () => {
    if (!canSend || !user) return;

    setSendingBulk(true);
    setShowReview(false);
    setSendProgress({ sent: 0, total: selectedCompanies.length });
    let successCount = 0;
    const BATCH_SIZE = 5;
    const withEmail = selectedCompanies.filter((c) => c.email?.trim());

    for (let i = 0; i < withEmail.length; i += BATCH_SIZE) {
      const batch = withEmail.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (company) => {
          const pBody = emailBody
            .replace(/\{company\}/gi, company.name)
            .replace(/\{industry\}/gi, company.industry || "")
            .replace(/\{jobTitle\}/gi, jobTitle || "");
          const pSubject = emailSubject
            .replace(/\{company\}/gi, company.name)
            .replace(/\{jobTitle\}/gi, jobTitle || "");

          await supabase.from("marketing_emails").insert([
            {
              user_id: user.id,
              job_title: jobTitle || "General",
              industry: industry || "General",
              language: emailLang,
              tone,
              subject: pSubject,
              body: pBody,
              recipient_email: company.email,
              company_name: company.name,
              selected_resume_id: selectedResumeId,
              action_type: "sent",
              gmail_status: "sending",
            },
          ]);

          const { error } = await supabase.functions.invoke("gmail-send", {
            body: {
              action: "send",
              to: company.email,
              subject: pSubject,
              body: pBody,
              resumeId: selectedResumeId,
              resumeType: selectedResumeType,
            },
          });
          if (error) throw error;
        }),
      );

      results.forEach((r) => {
        if (r.status === "fulfilled") successCount++;
        else console.error("Send failed:", r.reason);
      });
      setSendProgress({
        sent: Math.min(i + BATCH_SIZE, withEmail.length),
        total: withEmail.length,
      });
    }

    if (successCount > 0) {
      const deductResult = await deductPoints(
        user.id,
        "marketing_per_100",
        ar ? `إرسال إلى ${successCount} شركة` : `Sent to ${successCount} companies`,
      );
      if (deductResult.success) setUserPoints(deductResult.balance);
      else setUserPoints((prev) => Math.max(0, prev - calcCost(successCount)));
    }

    toast.success(
      ar
        ? `✓ تم الإرسال إلى ${successCount} من ${selectedCompanies.length} شركة`
        : `✓ Sent to ${successCount}/${selectedCompanies.length} companies`,
    );
    setSendingBulk(false);
    await loadSentRecords();
    if (successCount > 0) setActiveTab("tracker");
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(ar ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatResumeDate = (d?: string) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString(ar ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // ═══════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════
  return (
    <div className="min-h-screen bg-background" dir={ar ? "rtl" : "ltr"}>
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="container max-w-4xl flex items-center gap-3 h-14">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-lg">
            <Link to="/dashboard">
              <ArrowLeft className={`w-4 h-4 ${ar ? "rotate-180" : ""}`} />
            </Link>
          </Button>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-sm">
              <Send className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm leading-none">Smart Send</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                {ar ? "إرسال ذكي للسيرة الذاتية عبر Gmail" : "Targeted CV outreach via Gmail"}
              </p>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-black text-sm text-amber-700 dark:text-amber-300">{userPoints}</span>
            <span className="text-[10px] text-amber-600/70">{ar ? "نقطة" : "pts"}</span>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-6 px-4 space-y-5">
        {/* ── STATS ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              icon: Send,
              label: ar ? "مُرسَل" : "Sent",
              value: sentCount,
              color: "text-emerald-500 bg-emerald-500/10",
            },
            {
              icon: Building2,
              label: ar ? "الشركات" : "Companies",
              value: companies.filter((c) => c.email).length,
              color: "text-blue-500 bg-blue-500/10",
            },
            {
              icon: Coins,
              label: ar ? "الرصيد" : "Balance",
              value: userPoints,
              color: "text-amber-500 bg-amber-500/10",
            },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className="text-lg font-black text-foreground leading-tight">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── GMAIL BLOCK ── */}
        <div
          className={`rounded-2xl border-2 p-4 transition-all ${gmailConnected ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${gmailConnected ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30" : "bg-muted text-muted-foreground"}`}
              >
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground">Gmail</p>
                  {gmailConnected && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                      {ar ? "متصل" : "Connected"}
                    </span>
                  )}
                </div>
                {gmailLoading ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {ar ? "جارٍ التحقق..." : "Checking..."}
                  </p>
                ) : gmailConnected ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{gmailEmail}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {ar ? "غير متصل — مطلوب للإرسال" : "Not connected — required to send"}
                  </p>
                )}
              </div>
            </div>

            {gmailConnected ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnectGmail}
                className="text-xs text-muted-foreground hover:text-destructive gap-1.5 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                {ar ? "قطع" : "Disconnect"}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnectGmail}
                disabled={gmailLoading}
                className="gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20"
              >
                <Mail className="w-3.5 h-3.5" />
                {ar ? "ربط Gmail" : "Connect Gmail"}
              </Button>
            )}
          </div>

          {!gmailConnected && !gmailLoading && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-amber-500/8 border border-amber-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {ar
                  ? "يجب ربط حساب Gmail لتتمكن من إرسال رسائل مباشرةً للشركات"
                  : "Connect your Gmail account to send outreach emails directly to companies"}
              </p>
            </div>
          )}
        </div>

        {/* ── TABS ── */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl w-fit">
          {(
            [
              { id: "compose", labelAr: "إنشاء وإرسال", labelEn: "Compose & Send" },
              {
                id: "tracker",
                labelAr: `السجل${sentRecords.length > 0 ? ` (${sentRecords.length})` : ""}`,
                labelEn: `Sent${sentRecords.length > 0 ? ` (${sentRecords.length})` : ""}`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${activeTab === tab.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {ar ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>

        {/* ══════════════ COMPOSE TAB ══════════════ */}
        {activeTab === "compose" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* STEP 1 — Resume Cards */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm font-bold text-foreground">
                  {ar ? "١ · اختر سيرتك الذاتية" : "1 · Choose your resume"}
                </span>
              </div>
              <div className="p-4">
                {resumes.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-sm text-muted-foreground">{t.marketing.noResumes}</p>
                    <Button variant="outline" size="sm" asChild className="rounded-lg mt-1">
                      <Link to="/resume">{ar ? "رفع سيرة ذاتية" : "Upload Resume"}</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {resumes.map((r) => {
                      const selected = r.id === selectedResumeId;
                      return (
                        <button
                          key={r.id}
                          onClick={() => {
                            setSelectedResumeId(r.id);
                            setSelectedResumeType(r.type);
                          }}
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all hover:border-violet-400
                            ${selected ? "border-violet-500 bg-violet-500/5 shadow-sm" : "border-border bg-card hover:bg-muted/30"}`}
                        >
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${selected ? "bg-violet-500 text-white" : "bg-muted text-muted-foreground"}`}
                          >
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-semibold truncate ${selected ? "text-violet-700 dark:text-violet-300" : "text-foreground"}`}
                            >
                              {r.file_name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                {r.type === "uploaded" ? (ar ? "مرفوعة" : "Uploaded") : ar ? "مُنشأة" : "Generated"}
                              </span>
                              {r.updated_at && (
                                <span className="text-[10px] text-muted-foreground">
                                  {formatResumeDate(r.updated_at)}
                                </span>
                              )}
                            </div>
                          </div>
                          {selected && <CheckCircle2 className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* STEP 2 — Outreach Goal */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-indigo-500" />
                </div>
                <span className="text-sm font-bold text-foreground">
                  {ar ? "٢ · هدف التواصل" : "2 · Outreach goal"}
                </span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3">
                  {OUTREACH_GOALS.map((g) => {
                    const active = outreachGoal === g.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => setOutreachGoal(g.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                          ${active ? "border-indigo-500 bg-indigo-500/5 shadow-sm" : "border-border hover:border-indigo-300 hover:bg-muted/30"}`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? "bg-indigo-500 text-white" : "bg-muted text-muted-foreground"}`}
                        >
                          <g.icon className="w-4 h-4" />
                        </div>
                        <span
                          className={`text-xs font-semibold text-center leading-tight ${active ? "text-indigo-700 dark:text-indigo-300" : "text-muted-foreground"}`}
                        >
                          {ar ? g.labelAr : g.labelEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* STEP 3 — Email Builder */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                </div>
                <span className="text-sm font-bold text-foreground flex-1">
                  {ar ? "٣ · إنشاء الرسالة" : "3 · Build your email"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all
                      ${previewMode ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  >
                    {previewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {previewMode ? (ar ? "تحرير" : "Edit") : ar ? "معاينة" : "Preview"}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateEmail}
                    disabled={generating || !selectedResumeId}
                    className="gap-1.5 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 rounded-lg"
                  >
                    {generating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {generating ? (ar ? "جارٍ..." : "Generating...") : ar ? "إنشاء بالذكاء" : "AI Draft"}
                  </Button>
                </div>
              </div>

              {previewMode ? (
                <div className="p-5 space-y-3" dir={emailLang === "ar" ? "rtl" : "ltr"}>
                  <div className="space-y-1 pb-3 border-b border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {ar ? "الموضوع" : "Subject"}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {emailSubject
                        .replace(/\{company\}/gi, ar ? "اسم الشركة" : "Company Name")
                        .replace(/\{jobTitle\}/gi, jobTitle || (ar ? "المسمى الوظيفي" : "Job Title"))}
                    </p>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {emailBody
                      .replace(/\{company\}/gi, ar ? "اسم الشركة" : "Company Name")
                      .replace(/\{industry\}/gi, industry || (ar ? "القطاع" : "Industry"))
                      .replace(/\{jobTitle\}/gi, jobTitle || (ar ? "المسمى الوظيفي" : "Job Title"))}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-border/60">
                    <span className="text-xs font-semibold text-muted-foreground w-14 flex-shrink-0">
                      {ar ? "الموضوع" : "Subject"}
                    </span>
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder={ar ? "عنوان الرسالة..." : "Email subject..."}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 flex-1 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleImproveSubject}
                      disabled={improvingSubject || !emailSubject.trim()}
                      className="flex-shrink-0 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 px-2 rounded-lg gap-1"
                    >
                      {improvingSubject ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      {ar ? "حسّن" : "Improve"}
                    </Button>
                  </div>

                  <div className="relative">
                    <Textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder={
                        ar
                          ? "نص الرسالة... استخدم {company} و{jobTitle} و{industry}"
                          : "Email body... Use {company}, {jobTitle}, {industry}"
                      }
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-5 py-4 min-h-[240px] resize-none text-sm leading-relaxed rounded-none"
                      dir={emailLang === "ar" ? "rtl" : "ltr"}
                    />
                    <div className="absolute bottom-3 end-3 flex gap-1.5">
                      {["{company}", "{jobTitle}", "{industry}"].map((v) => (
                        <button
                          key={v}
                          onClick={() => setEmailBody((p) => p + v)}
                          className="text-[10px] px-2 py-1 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 font-mono hover:bg-violet-500/20 transition-colors"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/40 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                      {selectedResume ? (
                        <span className="text-xs text-foreground truncate max-w-[160px]">
                          {selectedResume.file_name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t.marketing.noResumes}</span>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {emailLang === "ar" ? "🇸🇦 عربي" : "🇺🇸 English"}
                    </Badge>
                  </div>
                </>
              )}
            </div>

            {/* AI Settings (collapsible) */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setShowAiSettings(!showAiSettings)}
                className="flex items-center gap-3 text-sm font-semibold text-foreground w-full px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                </div>
                {ar ? "إعدادات الإنشاء بالذكاء الاصطناعي" : "AI Generation Settings"}
                <ChevronDown
                  className={`w-4 h-4 ms-auto text-muted-foreground transition-transform duration-200 ${showAiSettings ? "rotate-180" : ""}`}
                />
              </button>

              {showAiSettings && (
                <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-4">
                  {[
                    {
                      label: ar ? "المسمى الوظيفي" : "Job Title",
                      value: jobTitle,
                      onChange: setJobTitle,
                      placeholder: ar ? "مثال: مهندس برمجيات" : "e.g. Software Engineer",
                    },
                    {
                      label: ar ? "القطاع" : "Industry",
                      value: industry,
                      onChange: setIndustry,
                      placeholder: ar ? "مثال: تقنية المعلومات" : "e.g. Technology",
                    },
                  ].map((f, i) => (
                    <div key={i} className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">{f.label}</label>
                      <Input
                        value={f.value}
                        onChange={(e) => f.onChange(e.target.value)}
                        placeholder={f.placeholder}
                        className="h-9 text-sm bg-background rounded-lg"
                      />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      {ar ? "لغة الرسالة" : "Email Language"}
                    </label>
                    <Select value={emailLang} onValueChange={setEmailLang}>
                      <SelectTrigger className="h-9 bg-background rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">🇺🇸 {t.common.english}</SelectItem>
                        <SelectItem value="ar">🇸🇦 {t.common.arabic}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      {ar ? "نبرة الكتابة" : "Writing Tone"}
                    </label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger className="h-9 bg-background rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formal">{t.marketing.tones.formal}</SelectItem>
                        <SelectItem value="confident">{t.marketing.tones.confident}</SelectItem>
                        <SelectItem value="concise">{t.marketing.tones.concise}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 4 — Target Companies */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm font-bold text-foreground flex-1">
                  {ar ? "٤ · الشركات المستهدفة" : "4 · Target companies"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {filteredCompanies.length} {ar ? "متاح" : "available"}
                </span>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {COMPANY_COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      onClick={() => setCompanyCount(count)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all
                        ${companyCount === count ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300" : "border-border text-muted-foreground hover:border-violet-300"}`}
                    >
                      {count} {ar ? "شركة" : "co."}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search
                    className={`absolute ${ar ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground`}
                  />
                  <Input
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder={ar ? "فلترة بالاسم أو القطاع..." : "Filter by name or industry..."}
                    className={`${ar ? "pr-9" : "pl-9"} h-9 text-sm bg-background rounded-lg`}
                  />
                </div>

                <div
                  className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${canAfford ? "border-violet-500/30 bg-violet-500/5" : "border-red-500/30 bg-red-500/5"}`}
                >
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {selectedCompanies.length} {ar ? "شركة مستهدفة" : "companies targeted"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ar ? "جميعها لديها بريد إلكتروني" : "All have email addresses"}
                    </p>
                  </div>
                  <div className="text-end">
                    <div
                      className={`flex items-center gap-1.5 justify-end font-black text-lg ${canAfford ? "text-violet-600 dark:text-violet-400" : "text-red-500"}`}
                    >
                      <Coins className="w-4 h-4" />
                      {estimatedCost}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{ar ? "نقطة مطلوبة" : "points required"}</p>
                  </div>
                </div>

                {!canAfford && (
                  <div className="flex items-center gap-2 text-xs text-red-500">
                    <XCircle className="w-3.5 h-3.5" />
                    {ar
                      ? "رصيدك غير كافٍ — اشترِ نقاطاً من لوحة التحكم"
                      : "Insufficient balance — buy points from dashboard"}
                  </div>
                )}
              </div>
            </div>

            {/* SEND REVIEW PANEL */}
            {showReview && (
              <div className="rounded-2xl border-2 border-violet-500/40 bg-card overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-violet-500/5">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <Eye className="w-4 h-4 text-violet-500" />
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    {ar ? "مراجعة قبل الإرسال" : "Review before sending"}
                  </span>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { label: ar ? "السيرة الذاتية" : "Resume", value: selectedResume?.file_name || "—" },
                    {
                      label: ar ? "Gmail المُرسِل" : "Sending from",
                      value: gmailEmail || (ar ? "غير متصل" : "Not connected"),
                    },
                    {
                      label: ar ? "عدد المستلمين" : "Recipients",
                      value: `${selectedCompanies.length} ${ar ? "شركة" : "companies"}`,
                    },
                    {
                      label: ar ? "الموضوع" : "Subject",
                      value: emailSubject
                        .replace(/\{jobTitle\}/gi, jobTitle || "…")
                        .replace(/\{company\}/gi, ar ? "الشركة" : "Company"),
                    },
                    { label: ar ? "التكلفة" : "Cost", value: `${estimatedCost} ${ar ? "نقطة" : "points"}` },
                  ].map((row) => (
                    <div key={row.label} className="flex items-start gap-3">
                      <span className="text-xs font-semibold text-muted-foreground w-28 flex-shrink-0 pt-0.5">
                        {row.label}
                      </span>
                      <span className="text-xs text-foreground font-medium">{row.value}</span>
                    </div>
                  ))}

                  <div className="flex gap-3 pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowReview(false)}
                      className="rounded-lg text-xs"
                    >
                      {ar ? "تعديل" : "Edit"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleBulkSend}
                      disabled={!canSend}
                      className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {ar
                        ? `تأكيد وإرسال إلى ${selectedCompanies.length} شركة`
                        : `Confirm & Send to ${selectedCompanies.length}`}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* SEND / PROGRESS BUTTON */}
            {sendingBulk ? (
              <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-violet-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {ar
                        ? `جارٍ الإرسال — ${sendProgress.sent} / ${sendProgress.total}`
                        : `Sending — ${sendProgress.sent} / ${sendProgress.total}`}
                    </p>
                    <div className="w-full h-1.5 bg-violet-500/20 rounded-full mt-2">
                      <div
                        className="h-full bg-violet-500 rounded-full transition-all duration-300"
                        style={{
                          width: `${sendProgress.total > 0 ? (sendProgress.sent / sendProgress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Button
                size="lg"
                onClick={() => {
                  if (!canSend) {
                    if (!gmailConnected) toast.error(ar ? "ربط Gmail مطلوب" : "Connect Gmail first");
                    else if (!canAfford) toast.error(ar ? "رصيد غير كافٍ" : "Insufficient points");
                    else if (selectedCompanies.length === 0)
                      toast.error(ar ? "لا توجد شركات مؤهلة" : "No companies selected");
                    return;
                  }
                  setShowReview(true);
                  setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 100);
                }}
                disabled={sendingBulk}
                className={`w-full h-14 text-base font-bold rounded-xl gap-3 transition-all
                  ${canSend ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25" : "bg-muted text-muted-foreground"}`}
              >
                <Send className="w-5 h-5" />
                {ar
                  ? `مراجعة وإرسال إلى ${selectedCompanies.length} شركة`
                  : `Review & Send to ${selectedCompanies.length} companies`}
                {estimatedCost > 0 && (
                  <span className="text-sm font-normal opacity-70">
                    · {estimatedCost} {ar ? "نقطة" : "pts"}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 ms-auto opacity-60" />
              </Button>
            )}

            {!gmailConnected && !gmailLoading && (
              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                {ar ? "ربط Gmail مطلوب للإرسال" : "Gmail connection required to send"}
              </p>
            )}
          </div>
        )}

        {/* ══════════════ TRACKER TAB ══════════════ */}
        {activeTab === "tracker" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: ar ? "مُرسَل" : "Sent", value: sentCount, color: "text-emerald-500" },
                { label: ar ? "مسودة" : "Draft", value: sentRecords.length - sentCount, color: "text-blue-500" },
                {
                  label: ar ? "معدل الإرسال" : "Send Rate",
                  value: sentRecords.length > 0 ? `${Math.round((sentCount / sentRecords.length) * 100)}%` : "—",
                  color: "text-violet-500",
                },
              ].map((s, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-bold text-foreground">{ar ? "سجل الرسائل" : "Email History"}</span>
                  {sentRecords.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {sentRecords.length}
                    </Badge>
                  )}
                </div>
                {sentRecords.length > 0 && (
                  <div className="relative">
                    <Search
                      className={`absolute ${ar ? "right-2.5" : "left-2.5"} top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground`}
                    />
                    <Input
                      value={trackerSearch}
                      onChange={(e) => setTrackerSearch(e.target.value)}
                      placeholder={ar ? "بحث..." : "Search..."}
                      className={`${ar ? "pr-7" : "pl-7"} h-7 w-40 text-xs bg-background rounded-lg`}
                    />
                  </div>
                )}
              </div>

              {sentRecords.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
                    <Send className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {ar ? "لم يُرسَل شيء بعد" : "Nothing sent yet"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("compose")}
                    className="gap-1.5 rounded-lg text-xs"
                  >
                    <ArrowLeft className={`w-3.5 h-3.5 ${ar ? "rotate-180" : ""}`} />
                    {ar ? "إنشاء رسالة" : "Compose email"}
                  </Button>
                </div>
              ) : filteredSentRecords.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">{ar ? "لا نتائج" : "No results"}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filteredSentRecords.map((record) => (
                    <div
                      key={record.id}
                      className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-violet-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{record.company_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{record.recipient_email}</p>
                          <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5 italic">
                            {record.subject}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-end space-y-1">
                        <StatusBadge status={record.gmail_status} ar={ar} />
                        <p className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5 justify-end">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDate(record.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Marketing;
