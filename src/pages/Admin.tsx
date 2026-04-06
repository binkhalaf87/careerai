import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  FileText,
  BarChart3,
  Mail,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  Eye,
  Clock,
  Pencil,
  Trash2,
  CreditCard,
  Building2,
  Upload,
  Download,
  Plus,
  Coins,
  UserPlus,
  KeyRound,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface AdminMetrics {
  totalUsers: number;
  totalResumes: number;
  totalAnalyses: number;
  totalGenerated: number;
  totalEmails: number;
  recentSignups: number;
}

interface UserRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  role: string;
  resumeCount: number;
  analysisCount: number;
  generatedCount: number;
  emailCount: number;
  subscription_plan: string;
  subscription_status: string;
  points_balance: number;
}

interface ActivityItem {
  type: "resume" | "analysis" | "generated" | "email";
  user_email: string | null;
  title: string;
  created_at: string;
}

interface InspectData {
  profile: any;
  resumes: any[];
  analyses: any[];
  generated: any[];
  emails: any[];
  transactions: any[];
}

interface CompanyRow {
  id: string;
  name: string;
  industry: string | null;
  email: string | null;
  website: string | null;
  location: string | null;
  contact_person: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

const Admin = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const ar = language === "ar";
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "companies">("users");
  const [metrics, setMetrics] = useState<AdminMetrics>({
    totalUsers: 0,
    totalResumes: 0,
    totalAnalyses: 0,
    totalGenerated: 0,
    totalEmails: 0,
    recentSignups: 0,
  });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"created_at" | "resumeCount" | "analysisCount" | "points_balance">(
    "created_at",
  );
  const [sortAsc, setSortAsc] = useState(false);
  const [inspectUser, setInspectUser] = useState<string | null>(null);
  const [inspectData, setInspectData] = useState<InspectData | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Edit user state
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");

  // Add user state
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [addingUser, setAddingUser] = useState(false);

  // Delete user state
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // Subscription management state
  const [subUserId, setSubUserId] = useState<string | null>(null);
  const [subPlan, setSubPlan] = useState<string>("free");
  const [subStatus, setSubStatus] = useState<string>("active");
  const [subNotes, setSubNotes] = useState("");
  const [subExpiresAt, setSubExpiresAt] = useState("");

  // Points management state
  const [pointsUserId, setPointsUserId] = useState<string | null>(null);
  const [pointsAction, setPointsAction] = useState<"add" | "subtract" | "set">("add");
  const [pointsAmount, setPointsAmount] = useState("");
  const [pointsDescription, setPointsDescription] = useState("");
  const [pointsUserBalance, setPointsUserBalance] = useState(0);

  // Companies state
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [companyUploading, setCompanyUploading] = useState(false);
  const [deleteCompanyId, setDeleteCompanyId] = useState<string | null>(null);
  const [editCompany, setEditCompany] = useState<CompanyRow | null>(null);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    industry: "",
    email: "",
    website: "",
    location: "",
    contact_person: "",
    phone: "",
    notes: "",
  });
  const companyFileRef = useRef<HTMLInputElement>(null);

  const fetchAdminData = async () => {
    const [profilesRes, resumesRes, analysesRes, generatedRes, emailsRes, rolesRes, subsRes, txRes] = await Promise.all(
      [
        supabase.from("profiles").select("user_id, display_name, email, created_at"),
        supabase.from("resumes").select("id, user_id, file_name, created_at"),
        supabase.from("analyses").select("id, user_id, overall_score, created_at"),
        supabase.from("generated_resumes").select("id, user_id, title, created_at"),
        supabase.from("marketing_emails").select("id, user_id, subject, created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("subscriptions").select("user_id, plan, status"),
        supabase.from("point_transactions").select("user_id, amount"),
      ],
    );

    const profiles = profilesRes.data || [];
    const resumes = resumesRes.data || [];
    const analyses = analysesRes.data || [];
    const generated = generatedRes.data || [];
    const emails = emailsRes.data || [];
    const roles = rolesRes.data || [];
    const subs = subsRes.data || [];
    const transactions = txRes.data || [];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    setMetrics({
      totalUsers: profiles.length,
      totalResumes: resumes.length,
      totalAnalyses: analyses.length,
      totalGenerated: generated.length,
      totalEmails: emails.length,
      recentSignups: profiles.filter((p) => new Date(p.created_at) >= sevenDaysAgo).length,
    });

    const roleMap = new Map<string, string>();
    roles.forEach((r) => roleMap.set(r.user_id, r.role));

    const subMap = new Map<string, { plan: string; status: string }>();
    subs.forEach((s) => subMap.set(s.user_id, { plan: s.plan, status: s.status }));

    // Calculate points balance per user
    const pointsMap = new Map<string, number>();
    transactions.forEach((tx: any) => {
      pointsMap.set(tx.user_id, (pointsMap.get(tx.user_id) || 0) + tx.amount);
    });

    const userRows: UserRow[] = profiles.map((p) => {
      const sub = subMap.get(p.user_id);
      return {
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.email,
        created_at: p.created_at,
        role: roleMap.get(p.user_id) || "user",
        resumeCount: resumes.filter((r) => r.user_id === p.user_id).length,
        analysisCount: analyses.filter((a) => a.user_id === p.user_id).length,
        generatedCount: generated.filter((g) => g.user_id === p.user_id).length,
        emailCount: emails.filter((e) => e.user_id === p.user_id).length,
        subscription_plan: sub?.plan || "free",
        subscription_status: sub?.status || "inactive",
        points_balance: pointsMap.get(p.user_id) || 0,
      };
    });
    setUsers(userRows);

    const emailMap = new Map<string, string>();
    profiles.forEach((p) => emailMap.set(p.user_id, p.email || "—"));

    const activityItems: ActivityItem[] = [
      ...resumes.map((r) => ({
        type: "resume" as const,
        user_email: emailMap.get(r.user_id) || null,
        title: r.file_name,
        created_at: r.created_at,
      })),
      ...analyses.map((a) => ({
        type: "analysis" as const,
        user_email: emailMap.get(a.user_id) || null,
        title: `Score: ${a.overall_score}`,
        created_at: a.created_at,
      })),
      ...generated.map((g) => ({
        type: "generated" as const,
        user_email: emailMap.get(g.user_id) || null,
        title: g.title,
        created_at: g.created_at,
      })),
      ...emails.map((e) => ({
        type: "email" as const,
        user_email: emailMap.get(e.user_id) || null,
        title: e.subject,
        created_at: e.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);

    setActivity(activityItems);
  };

  const fetchCompanies = async () => {
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    if (data) setCompanies(data as CompanyRow[]);
  };

  useEffect(() => {
    if (!user) return;
    // Use the has_role RPC function (SECURITY DEFINER) instead of reading user_roles directly
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data, error }) => {
      if (error) {
        console.error("[Admin] role check error:", error.message);
        setIsAdmin(false);
        return;
      }
      setIsAdmin(!!data);
    });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchAdminData();
    fetchCompanies();
  }, [isAdmin]);

  // --- Add User ---
  const handleAddUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) return;
    setAddingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: {
          action: "create_user",
          email: newUserEmail.trim(),
          password: newUserPassword,
          full_name: newUserName.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(ar ? "تم إنشاء المستخدم بنجاح" : "User created successfully");
      setAddUserOpen(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserName("");
      fetchAdminData();
    } catch (err: any) {
      toast.error(err?.message || t.common.error);
    }
    setAddingUser(false);
  };

  // --- Inspect User ---
  const handleInspect = async (userId: string) => {
    setInspectUser(userId);
    setInspectLoading(true);
    const [profileRes, resumesRes, analysesRes, generatedRes, emailsRes, txRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
      supabase
        .from("resumes")
        .select("id, file_name, file_type, language, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("analyses")
        .select("id, overall_score, language, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("generated_resumes")
        .select("id, title, language, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("marketing_emails")
        .select("id, subject, job_title, industry, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("point_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    setInspectData({
      profile: profileRes.data,
      resumes: resumesRes.data || [],
      analyses: analysesRes.data || [],
      generated: generatedRes.data || [],
      emails: emailsRes.data || [],
      transactions: txRes.data || [],
    });
    setInspectLoading(false);
  };

  // --- Edit User (profile + auth) ---
  const handleEditUser = (u: UserRow) => {
    setEditUserId(u.user_id);
    setEditName(u.display_name || "");
    setEditEmail(u.email || "");
    setEditPhone("");
    setEditPassword("");
  };

  const handleSaveEdit = async () => {
    if (!editUserId) return;
    // Update profile
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: editName,
        email: editEmail,
        phone: editPhone || null,
      })
      .eq("user_id", editUserId);

    if (error) {
      toast.error(t.common.error);
      return;
    }

    // Update auth email/password if changed
    const authUpdates: any = {};
    const originalUser = users.find((u) => u.user_id === editUserId);
    if (editEmail && editEmail !== originalUser?.email) authUpdates.email = editEmail;
    if (editPassword.trim()) authUpdates.password = editPassword;

    if (Object.keys(authUpdates).length > 0) {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("admin-manage-user", {
          body: { action: "update_user", user_id: editUserId, ...authUpdates },
        });
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);
      } catch (err: any) {
        toast.error(err?.message || (ar ? "خطأ في تحديث بيانات المصادقة" : "Error updating auth data"));
        return;
      }
    }

    toast.success(t.admin.profileUpdated);
    setEditUserId(null);
    fetchAdminData();
  };

  // --- Delete User ---
  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    await Promise.all([
      supabase.from("analyses").delete().eq("user_id", deleteUserId),
      supabase.from("generated_resumes").delete().eq("user_id", deleteUserId),
      supabase.from("marketing_emails").delete().eq("user_id", deleteUserId),
      supabase.from("enhancement_sessions").delete().eq("user_id", deleteUserId),
      supabase.from("subscriptions").delete().eq("user_id", deleteUserId),
      supabase.from("point_transactions").delete().eq("user_id", deleteUserId),
    ]);
    await supabase.from("resumes").delete().eq("user_id", deleteUserId);
    const { error } = await supabase.from("profiles").delete().eq("user_id", deleteUserId);

    if (error) {
      toast.error(t.common.error);
    } else {
      toast.success(t.admin.userDeleted);
      setDeleteUserId(null);
      fetchAdminData();
    }
  };

  // --- Subscription ---
  const handleOpenSubscription = (u: UserRow) => {
    setSubUserId(u.user_id);
    setSubPlan(u.subscription_plan);
    setSubStatus(u.subscription_status === "inactive" ? "active" : u.subscription_status);
    setSubNotes("");
    setSubExpiresAt("");
  };

  const handleSaveSubscription = async () => {
    if (!subUserId || !user) return;
    const { data: existing } = await supabase.from("subscriptions").select("id").eq("user_id", subUserId).maybeSingle();

    const subData = {
      user_id: subUserId,
      plan: subPlan as any,
      status: subStatus as any,
      activated_by: user.id,
      activated_at: new Date().toISOString(),
      expires_at: subExpiresAt ? new Date(subExpiresAt).toISOString() : null,
      notes: subNotes || null,
    };

    let error;
    if (existing) {
      ({ error } = await supabase.from("subscriptions").update(subData).eq("user_id", subUserId));
    } else {
      ({ error } = await supabase.from("subscriptions").insert(subData));
    }

    if (error) {
      toast.error(t.common.error);
    } else {
      toast.success(t.admin.subscriptionUpdated);
      setSubUserId(null);
      fetchAdminData();
    }
  };

  // --- Points Management ---
  const handleOpenPoints = (u: UserRow) => {
    setPointsUserId(u.user_id);
    setPointsUserBalance(u.points_balance);
    setPointsAction("add");
    setPointsAmount("");
    setPointsDescription("");
  };

  const handleSavePoints = async () => {
    if (!pointsUserId || !user || !pointsAmount) return;
    const numAmount = parseInt(pointsAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error(ar ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount");
      return;
    }

    let finalAmount: number;
    let txType: string;
    let desc = pointsDescription.trim();

    if (pointsAction === "add") {
      finalAmount = numAmount;
      txType = "admin_credit";
      if (!desc) desc = ar ? "إضافة نقاط من المدير" : "Admin credit";
    } else if (pointsAction === "subtract") {
      finalAmount = -numAmount;
      txType = "admin_debit";
      if (!desc) desc = ar ? "خصم نقاط من المدير" : "Admin debit";
    } else {
      // set: insert the difference
      finalAmount = numAmount - pointsUserBalance;
      txType = "admin_set";
      if (!desc) desc = ar ? `تعيين الرصيد إلى ${numAmount}` : `Set balance to ${numAmount}`;
    }

    const { error } = await supabase.from("point_transactions").insert({
      user_id: pointsUserId,
      amount: finalAmount,
      type: txType,
      description: desc,
      admin_id: user.id,
    } as any);

    if (error) {
      toast.error(t.common.error);
    } else {
      toast.success(ar ? "تم تحديث النقاط بنجاح" : "Points updated successfully");
      setPointsUserId(null);
      fetchAdminData();
    }
  };

  // --- Companies handlers ---
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        name: "Example Company",
        industry: "Technology",
        email: "hr@example.com",
        website: "https://example.com",
        location: "Riyadh",
        contact_person: "Ahmed",
        phone: "+966500000000",
        notes: "",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Companies");
    XLSX.writeFile(wb, "companies_template.xlsx");
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompanyUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      if (rows.length === 0) {
        toast.error(ar ? "الملف فارغ" : "File is empty");
        setCompanyUploading(false);
        return;
      }

      const toInsert = rows
        .map((r) => ({
          name: String(r.name || "").trim(),
          industry: r.industry ? String(r.industry).trim() : null,
          email: r.email ? String(r.email).trim() : null,
          website: r.website ? String(r.website).trim() : null,
          location: r.location ? String(r.location).trim() : null,
          contact_person: r.contact_person ? String(r.contact_person).trim() : null,
          phone: r.phone ? String(r.phone).trim() : null,
          notes: r.notes ? String(r.notes).trim() : null,
        }))
        .filter((r) => r.name.length > 0);

      if (toInsert.length === 0) {
        toast.error(ar ? "لا توجد بيانات صالحة" : "No valid data found");
        setCompanyUploading(false);
        return;
      }

      const { error } = await supabase.from("companies").insert(toInsert as any);
      if (error) {
        toast.error(t.common.error);
      } else {
        toast.success(
          ar ? `تم إضافة ${toInsert.length} شركة بنجاح` : `${toInsert.length} companies added successfully`,
        );
        fetchCompanies();
      }
    } catch {
      toast.error(ar ? "خطأ في قراءة الملف" : "Error reading file");
    }
    setCompanyUploading(false);
    if (companyFileRef.current) companyFileRef.current.value = "";
  };

  const handleAddCompany = async () => {
    if (!companyForm.name.trim()) return;
    const { error } = await supabase.from("companies").insert({
      name: companyForm.name.trim(),
      industry: companyForm.industry.trim() || null,
      email: companyForm.email.trim() || null,
      website: companyForm.website.trim() || null,
      location: companyForm.location.trim() || null,
      contact_person: companyForm.contact_person.trim() || null,
      phone: companyForm.phone.trim() || null,
      notes: companyForm.notes.trim() || null,
    } as any);
    if (error) {
      toast.error(t.common.error);
    } else {
      toast.success(ar ? "تم إضافة الشركة" : "Company added");
      setAddCompanyOpen(false);
      setCompanyForm({
        name: "",
        industry: "",
        email: "",
        website: "",
        location: "",
        contact_person: "",
        phone: "",
        notes: "",
      });
      fetchCompanies();
    }
  };

  const handleSaveCompany = async () => {
    if (!editCompany) return;
    const { error } = await supabase
      .from("companies")
      .update({
        name: companyForm.name.trim(),
        industry: companyForm.industry.trim() || null,
        email: companyForm.email.trim() || null,
        website: companyForm.website.trim() || null,
        location: companyForm.location.trim() || null,
        contact_person: companyForm.contact_person.trim() || null,
        phone: companyForm.phone.trim() || null,
        notes: companyForm.notes.trim() || null,
      })
      .eq("id", editCompany.id);
    if (error) {
      toast.error(t.common.error);
    } else {
      toast.success(ar ? "تم تحديث الشركة" : "Company updated");
      setEditCompany(null);
      fetchCompanies();
    }
  };

  const handleDeleteCompany = async () => {
    if (!deleteCompanyId) return;
    const { error } = await supabase.from("companies").delete().eq("id", deleteCompanyId);
    if (error) {
      toast.error(t.common.error);
    } else {
      toast.success(ar ? "تم حذف الشركة" : "Company deleted");
      setDeleteCompanyId(null);
      fetchCompanies();
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredUsers = useMemo(() => {
    let filtered = users;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) => (u.display_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q),
      );
    }
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      if (typeof aVal === "number" && typeof bVal === "number") return sortAsc ? aVal - bVal : bVal - aVal;
      return sortAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
  }, [users, searchQuery, sortField, sortAsc]);

  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies;
    const q = companySearch.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.industry || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.location || "").toLowerCase().includes(q),
    );
  }, [companies, companySearch]);

  const activityIcon = (type: string) => {
    switch (type) {
      case "resume":
        return <FileText size={14} className="text-primary" />;
      case "analysis":
        return <BarChart3 size={14} className="text-primary" />;
      case "generated":
        return <Sparkles size={14} className="text-primary" />;
      case "email":
        return <Mail size={14} className="text-primary" />;
      default:
        return <Clock size={14} />;
    }
  };

  const activityLabel = (type: string) => {
    switch (type) {
      case "resume":
        return "Upload";
      case "analysis":
        return "Analysis";
      case "generated":
        return "Generated";
      case "email":
        return "Email";
      default:
        return type;
    }
  };

  const planLabel = (plan: string) => {
    switch (plan) {
      case "basic":
        return ar ? "أساسي" : "Basic";
      case "pro":
        return ar ? "احترافي" : "Professional";
      case "publish_only":
        return ar ? "نشر فقط" : "Publish Only";
      case "enterprise":
        return ar ? "مؤسسات" : "Enterprise";
      default:
        return ar ? "مجاني" : "Free";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "active":
        return t.admin.active;
      case "expired":
        return t.admin.expired;
      default:
        return t.admin.inactive;
    }
  };

  const planBadgeClass = (plan: string) => {
    switch (plan) {
      case "basic":
        return "bg-blue-500/10 text-blue-600";
      case "pro":
        return "bg-primary/10 text-primary";
      case "publish_only":
        return "bg-orange-500/10 text-orange-600";
      case "enterprise":
        return "bg-accent/10 text-accent-foreground";
      default:
        return "bg-secondary text-muted-foreground";
    }
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-600";
      case "expired":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-secondary text-muted-foreground";
    }
  };

  const txTypeLabel = (type: string) => {
    const labels: Record<string, string> = ar
      ? {
          admin_credit: "إضافة من المدير",
          admin_debit: "خصم من المدير",
          admin_set: "تعيين رصيد",
          purchase: "شراء",
          analysis: "تحليل",
          enhancement: "تحسين",
          marketing_send: "إرسال تسويقي",
        }
      : {
          admin_credit: "Admin Credit",
          admin_debit: "Admin Debit",
          admin_set: "Balance Set",
          purchase: "Purchase",
          analysis: "Analysis",
          enhancement: "Enhancement",
          marketing_send: "Marketing Send",
        };
    return labels[type] || type;
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-body">{t.common.loading}</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">{t.admin.accessDenied}</h1>
          <p className="text-muted-foreground font-body mb-4">{t.admin.accessDeniedDesc}</p>
          <Button asChild>
            <Link to="/dashboard">{t.common.back}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const metricCards = [
    { label: t.admin.totalUsers, value: metrics.totalUsers, icon: Users, color: "text-primary" },
    { label: t.admin.totalResumes, value: metrics.totalResumes, icon: FileText, color: "text-primary" },
    { label: t.admin.totalAnalyses, value: metrics.totalAnalyses, icon: BarChart3, color: "text-primary" },
    { label: t.admin.totalGenerated, value: metrics.totalGenerated, icon: Sparkles, color: "text-primary" },
    { label: t.admin.totalEmails, value: metrics.totalEmails, icon: Mail, color: "text-primary" },
    { label: ar ? "الشركات" : "Companies", value: companies.length, icon: Building2, color: "text-primary" },
  ];

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field ? (
      sortAsc ? (
        <ChevronUp size={14} />
      ) : (
        <ChevronDown size={14} />
      )
    ) : (
      <ChevronDown size={14} className="opacity-30" />
    );

  const CompanyFormFields = () => (
    <div className="space-y-3">
      {[
        { key: "name", label: ar ? "اسم الشركة" : "Company Name", required: true },
        { key: "industry", label: ar ? "القطاع" : "Industry" },
        { key: "email", label: ar ? "البريد الإلكتروني" : "Email" },
        { key: "website", label: ar ? "الموقع الإلكتروني" : "Website" },
        { key: "location", label: ar ? "الموقع" : "Location" },
        { key: "contact_person", label: ar ? "جهة الاتصال" : "Contact Person" },
        { key: "phone", label: ar ? "الهاتف" : "Phone" },
        { key: "notes", label: ar ? "ملاحظات" : "Notes" },
      ].map((f) => (
        <div key={f.key}>
          <label className="text-sm font-medium text-foreground mb-1 block">
            {f.label}
            {f.required ? " *" : ""}
          </label>
          <Input
            value={(companyForm as any)[f.key]}
            onChange={(e) => setCompanyForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background" dir={ar ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="container flex items-center gap-4 h-16">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft size={18} />
            </Link>
          </Button>
          <Link to="/dashboard" className="font-display text-lg font-bold text-foreground">
            TALEN<span className="text-primary">TRY</span>
          </Link>
          <span className="text-border/60 hidden sm:inline">/</span>
          <h1 className="font-display font-semibold text-foreground text-sm hidden sm:block">{t.admin.title}</h1>
        </div>
      </header>

      <main className="container py-8 md:py-12">
        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          {metricCards.map((m) => (
            <div key={m.label} className="p-4 bg-card rounded-xl border border-border text-center">
              <m.icon size={20} className={`${m.color} mx-auto mb-2`} />
              <div className="text-2xl font-display font-bold text-foreground">{m.value}</div>
              <div className="text-xs text-muted-foreground font-body">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Tab selector */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "users" ? "default" : "outline"}
            onClick={() => setActiveTab("users")}
            className="gap-2"
          >
            <Users size={16} />
            {ar ? "المستخدمين" : "Users"}
          </Button>
          <Button
            variant={activeTab === "companies" ? "default" : "outline"}
            onClick={() => setActiveTab("companies")}
            className="gap-2"
          >
            <Building2 size={16} />
            {ar ? "الشركات" : "Companies"}
          </Button>
        </div>

        {activeTab === "users" ? (
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Users Table */}
            <div className="lg:col-span-2 bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center gap-4 flex-wrap">
                <h2 className="font-display font-semibold text-foreground">{t.admin.usersTable}</h2>
                <div className="flex-1" />
                <div className="relative w-64">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t.admin.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm bg-background"
                  />
                </div>
                <Button size="sm" className="gap-2" onClick={() => setAddUserOpen(true)}>
                  <UserPlus size={14} />
                  {ar ? "إضافة مستخدم" : "Add User"}
                </Button>
              </div>
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground font-body py-8 text-center">{t.admin.noUsers}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-start px-4 py-3 font-display font-medium text-foreground">
                          {t.admin.name}
                        </th>
                        <th className="text-start px-4 py-3 font-display font-medium text-foreground">
                          {t.admin.email}
                        </th>
                        <th className="text-start px-4 py-3 font-display font-medium text-foreground">
                          {t.admin.subscription}
                        </th>
                        <th
                          className="text-center px-4 py-3 font-display font-medium text-foreground cursor-pointer select-none"
                          onClick={() => handleSort("points_balance")}
                        >
                          <span className="flex items-center justify-center gap-1">
                            <Coins size={12} />
                            {ar ? "النقاط" : "Points"}
                            <SortIcon field="points_balance" />
                          </span>
                        </th>
                        <th
                          className="text-start px-4 py-3 font-display font-medium text-foreground cursor-pointer select-none"
                          onClick={() => handleSort("created_at")}
                        >
                          <span className="flex items-center gap-1">
                            {t.admin.joined}
                            <SortIcon field="created_at" />
                          </span>
                        </th>
                        <th className="text-center px-4 py-3 font-display font-medium text-foreground">
                          {t.admin.actions}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.user_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-body text-foreground">
                            <div>
                              <p className="font-medium">{u.display_name || "—"}</p>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${u.role === "admin" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}
                              >
                                {u.role}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-body text-muted-foreground text-xs">{u.email || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${planBadgeClass(u.subscription_plan)}`}
                              >
                                {planLabel(u.subscription_plan)}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(u.subscription_status)}`}
                              >
                                {statusLabel(u.subscription_status)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-body text-foreground text-center font-semibold">
                            <span
                              className={
                                u.points_balance > 0
                                  ? "text-primary"
                                  : u.points_balance < 0
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                              }
                            >
                              {u.points_balance}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-body text-muted-foreground text-xs">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleInspect(u.user_id)}
                                className="h-7 w-7"
                                title={t.admin.inspectUser}
                              >
                                <Eye size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenPoints(u)}
                                className="h-7 w-7"
                                title={ar ? "إدارة النقاط" : "Manage Points"}
                              >
                                <Coins size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenSubscription(u)}
                                className="h-7 w-7"
                                title={t.admin.activateSubscription}
                              >
                                <CreditCard size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditUser(u)}
                                className="h-7 w-7"
                                title={t.admin.editUser}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteUserId(u.user_id)}
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                title={t.admin.deleteUser}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="font-display font-semibold text-foreground">{t.admin.recentActivity}</h2>
              </div>
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground font-body py-8 text-center">{t.admin.noActivity}</p>
                ) : (
                  activity.map((item, i) => (
                    <div key={i} className="px-4 py-3 flex items-start gap-3">
                      <div className="mt-0.5">{activityIcon(item.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.user_email} · {activityLabel(item.type)}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Companies Tab */
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex flex-wrap items-center gap-3">
              <h2 className="font-display font-semibold text-foreground">
                {ar ? "إدارة الشركات" : "Companies Management"}
              </h2>
              <div className="flex-1" />
              <div className="relative w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={ar ? "بحث عن شركة..." : "Search companies..."}
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="pl-9 h-9 text-sm bg-background"
                />
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadTemplate}>
                <Download size={14} />
                {ar ? "تحميل القالب" : "Download Template"}
              </Button>
              <div>
                <input
                  ref={companyFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleExcelUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => companyFileRef.current?.click()}
                  disabled={companyUploading}
                >
                  <Upload size={14} />
                  {companyUploading ? (ar ? "جارٍ الرفع..." : "Uploading...") : ar ? "رفع Excel" : "Upload Excel"}
                </Button>
              </div>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  setCompanyForm({
                    name: "",
                    industry: "",
                    email: "",
                    website: "",
                    location: "",
                    contact_person: "",
                    phone: "",
                    notes: "",
                  });
                  setAddCompanyOpen(true);
                }}
              >
                <Plus size={14} />
                {ar ? "إضافة شركة" : "Add Company"}
              </Button>
            </div>

            {filteredCompanies.length === 0 ? (
              <div className="py-12 text-center">
                <Building2 size={32} className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground font-body">
                  {ar ? "لا توجد شركات بعد" : "No companies yet"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{ar ? "اسم الشركة" : "Company Name"}</TableHead>
                      <TableHead>{ar ? "القطاع" : "Industry"}</TableHead>
                      <TableHead>{ar ? "البريد" : "Email"}</TableHead>
                      <TableHead>{ar ? "الموقع" : "Location"}</TableHead>
                      <TableHead>{ar ? "جهة الاتصال" : "Contact"}</TableHead>
                      <TableHead className="text-center">{t.admin.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{c.industry || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{c.email || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{c.location || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{c.contact_person || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditCompany(c);
                                setCompanyForm({
                                  name: c.name,
                                  industry: c.industry || "",
                                  email: c.email || "",
                                  website: c.website || "",
                                  location: c.location || "",
                                  contact_person: c.contact_person || "",
                                  phone: c.phone || "",
                                  notes: c.notes || "",
                                });
                              }}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteCompanyId(c.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add User Dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{ar ? "إضافة مستخدم جديد" : "Add New User"}</DialogTitle>
            <DialogDescription>{ar ? "أنشئ حساباً جديداً للمستخدم" : "Create a new user account"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t.admin.displayName}</label>
              <Input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder={ar ? "الاسم الكامل" : "Full Name"}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t.admin.email} *</label>
              <Input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                {ar ? "كلمة المرور" : "Password"} *
              </label>
              <Input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleAddUser} disabled={addingUser || !newUserEmail.trim() || !newUserPassword.trim()}>
              {addingUser ? (ar ? "جارٍ الإنشاء..." : "Creating...") : ar ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspect User Dialog */}
      <Dialog
        open={!!inspectUser}
        onOpenChange={() => {
          setInspectUser(null);
          setInspectData(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{t.admin.inspectUser}</DialogTitle>
          </DialogHeader>
          {inspectLoading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">{t.common.loading}</p>
          ) : inspectData ? (
            <div className="space-y-6">
              <div className="p-4 bg-secondary/30 rounded-lg">
                <h3 className="font-display font-semibold text-foreground text-sm mb-2">{t.admin.profileData}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t.admin.name}:</span>{" "}
                    <span className="text-foreground">{inspectData.profile?.display_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.admin.email}:</span>{" "}
                    <span className="text-foreground">{inspectData.profile?.email || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.admin.phone}:</span>{" "}
                    <span className="text-foreground">{inspectData.profile?.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.admin.joined}:</span>{" "}
                    <span className="text-foreground">
                      {inspectData.profile?.created_at
                        ? new Date(inspectData.profile.created_at).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="transactions">
                <TabsList className="flex-wrap">
                  <TabsTrigger value="transactions">
                    <Coins size={12} className="mr-1" />
                    {ar ? "النقاط" : "Points"} ({inspectData.transactions.length})
                  </TabsTrigger>
                  <TabsTrigger value="resumes">
                    {t.admin.resumes} ({inspectData.resumes.length})
                  </TabsTrigger>
                  <TabsTrigger value="analyses">
                    {t.admin.analyses} ({inspectData.analyses.length})
                  </TabsTrigger>
                  <TabsTrigger value="generated">
                    {t.admin.generated} ({inspectData.generated.length})
                  </TabsTrigger>
                  <TabsTrigger value="emails">
                    {t.admin.emails} ({inspectData.emails.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="transactions">
                  {inspectData.transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">{t.admin.noData}</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 bg-primary/10 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">{ar ? "الرصيد الحالي" : "Current Balance"}</p>
                        <p className="text-2xl font-bold font-display text-primary">
                          {inspectData.transactions.reduce((sum: number, tx: any) => sum + tx.amount, 0)}
                        </p>
                      </div>
                      {inspectData.transactions.map((tx: any) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg text-sm"
                        >
                          <div>
                            <span className={`font-bold ${tx.amount >= 0 ? "text-primary" : "text-destructive"}`}>
                              {tx.amount >= 0 ? "+" : ""}
                              {tx.amount}
                            </span>
                            <span className="text-muted-foreground text-xs ml-2">{txTypeLabel(tx.type)}</span>
                            {tx.description && <p className="text-xs text-muted-foreground mt-0.5">{tx.description}</p>}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="resumes">
                  {inspectData.resumes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">{t.admin.noData}</p>
                  ) : (
                    <div className="space-y-2">
                      {inspectData.resumes.map((r: any) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg text-sm"
                        >
                          <span className="font-body text-foreground">{r.file_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="analyses">
                  {inspectData.analyses.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">{t.admin.noData}</p>
                  ) : (
                    <div className="space-y-2">
                      {inspectData.analyses.map((a: any) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg text-sm"
                        >
                          <span className="font-body text-foreground">Score: {a.overall_score}/100</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(a.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="generated">
                  {inspectData.generated.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">{t.admin.noData}</p>
                  ) : (
                    <div className="space-y-2">
                      {inspectData.generated.map((g: any) => (
                        <div
                          key={g.id}
                          className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg text-sm"
                        >
                          <span className="font-body text-foreground">{g.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(g.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="emails">
                  {inspectData.emails.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">{t.admin.noData}</p>
                  ) : (
                    <div className="space-y-2">
                      {inspectData.emails.map((e: any) => (
                        <div
                          key={e.id}
                          className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg text-sm"
                        >
                          <div>
                            <span className="font-body text-foreground">{e.subject}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {e.job_title} · {e.industry}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(e.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUserId} onOpenChange={() => setEditUserId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{t.admin.editProfile}</DialogTitle>
            <DialogDescription>
              {ar
                ? "تعديل بيانات المستخدم بما فيها البريد وكلمة المرور"
                : "Edit user data including email and password"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t.admin.displayName}</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t.admin.email}</label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t.admin.phone}</label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                <KeyRound size={14} />
                {ar ? "كلمة المرور الجديدة" : "New Password"}
              </label>
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder={ar ? "اتركها فارغة إذا لا تريد تغييرها" : "Leave empty to keep current"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserId(null)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSaveEdit}>{t.admin.saveChanges}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Points Management Dialog */}
      <Dialog open={!!pointsUserId} onOpenChange={() => setPointsUserId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Coins size={18} className="text-primary" />
              {ar ? "إدارة النقاط" : "Points Management"}
            </DialogTitle>
            <DialogDescription>
              {users.find((u) => u.user_id === pointsUserId)?.email || ""}
              {" · "}
              {ar ? "الرصيد الحالي:" : "Current balance:"}{" "}
              <span className="font-bold text-primary">{pointsUserBalance}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{ar ? "نوع العملية" : "Action"}</label>
              <Select value={pointsAction} onValueChange={(v: any) => setPointsAction(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">{ar ? "إضافة نقاط" : "Add Points"}</SelectItem>
                  <SelectItem value="subtract">{ar ? "خصم نقاط" : "Subtract Points"}</SelectItem>
                  <SelectItem value="set">{ar ? "تعيين الرصيد" : "Set Balance"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                {pointsAction === "set" ? (ar ? "الرصيد الجديد" : "New Balance") : ar ? "المبلغ" : "Amount"}
              </label>
              <Input
                type="number"
                min="0"
                value={pointsAmount}
                onChange={(e) => setPointsAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                {ar ? "الوصف (اختياري)" : "Description (optional)"}
              </label>
              <Input
                value={pointsDescription}
                onChange={(e) => setPointsDescription(e.target.value)}
                placeholder={ar ? "سبب العملية" : "Reason for this action"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPointsUserId(null)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSavePoints} disabled={!pointsAmount}>
              {t.admin.saveChanges}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Management Dialog */}
      <Dialog open={!!subUserId} onOpenChange={() => setSubUserId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{t.admin.subscriptionManagement}</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {users.find((u) => u.user_id === subUserId)?.email || ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t.admin.selectPlan}</label>
              <Select value={subPlan} onValueChange={setSubPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">{ar ? "مجاني" : "Free"}</SelectItem>
                  <SelectItem value="basic">{ar ? "أساسي - 49 ر.س" : "Basic - 49 SAR"}</SelectItem>
                  <SelectItem value="pro">{ar ? "احترافي - 229 ر.س" : "Professional - 229 SAR"}</SelectItem>
                  <SelectItem value="publish_only">{ar ? "نشر فقط - 199 ر.س" : "Publish Only - 199 SAR"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t.admin.selectStatus}</label>
              <Select value={subStatus} onValueChange={setSubStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t.admin.active}</SelectItem>
                  <SelectItem value="inactive">{t.admin.inactive}</SelectItem>
                  <SelectItem value="expired">{t.admin.expired}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t.admin.expiresAt}</label>
              <Input type="date" value={subExpiresAt} onChange={(e) => setSubExpiresAt(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t.admin.notes}</label>
              <Input value={subNotes} onChange={(e) => setSubNotes(e.target.value)} placeholder="..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubUserId(null)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSaveSubscription}>{t.admin.saveChanges}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.admin.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>{t.admin.deleteUserConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Company Dialog */}
      <Dialog open={addCompanyOpen} onOpenChange={setAddCompanyOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{ar ? "إضافة شركة" : "Add Company"}</DialogTitle>
          </DialogHeader>
          <CompanyFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCompanyOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleAddCompany} disabled={!companyForm.name.trim()}>
              {ar ? "إضافة" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={!!editCompany} onOpenChange={() => setEditCompany(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{ar ? "تعديل الشركة" : "Edit Company"}</DialogTitle>
          </DialogHeader>
          <CompanyFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCompany(null)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSaveCompany}>{t.admin.saveChanges}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Company Confirmation */}
      <AlertDialog open={!!deleteCompanyId} onOpenChange={() => setDeleteCompanyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.admin.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>
              {ar ? "هل أنت متأكد من حذف هذه الشركة؟" : "Are you sure you want to delete this company?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCompany}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
