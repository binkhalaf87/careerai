import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, User, Mail, Phone, Globe, Building2, Briefcase, BadgeCheck,
  CreditCard, Coins, Receipt, Clock, CheckCircle2, XCircle,
  ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAccountType } from "@/contexts/AccountTypeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar as arLocale } from "date-fns/locale";

interface PaymentOrder {
  id: string;
  amount_cents: number;
  currency: string;
  points: number;
  package_name: string;
  status: string;
  payment_method: string | null;
  paymob_transaction_id: string | null;
  error_message: string | null;
  created_at: string;
}

interface PointTransaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

const statusConfig: Record<string, { color: string; icon: typeof Clock; labelEn: string; labelAr: string }> = {
  pending: { color: "bg-yellow-500/15 text-yellow-700 border-yellow-300", icon: Clock, labelEn: "Pending", labelAr: "قيد الانتظار" },
  paid: { color: "bg-emerald-500/15 text-emerald-700 border-emerald-300", icon: CheckCircle2, labelEn: "Paid", labelAr: "مدفوع" },
  failed: { color: "bg-red-500/15 text-red-700 border-red-300", icon: XCircle, labelEn: "Failed", labelAr: "فشل" },
};

const Profile = () => {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { accountType, dbAccountType, switchView, refetch } = useAccountType();
  const isRecruiter = accountType === "recruiter" || dbAccountType === "recruiter";
  const isAr = language === "ar";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resumeCount, setResumeCount] = useState(0);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [generatedCount, setGeneratedCount] = useState(0);

  // Transactions state
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [pointsTxns, setPointsTxns] = useState<PointTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [profileRes, resumesRes, analysesRes, generatedRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("resumes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("analyses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("generated_resumes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      if (profileRes.data) {
        setName(profileRes.data.display_name || "");
        setEmail(profileRes.data.email || user.email || "");
        setPhone(profileRes.data.phone || "");
        setCompanyName(profileRes.data.company_name || "");
        setJobTitle(profileRes.data.job_title || "");
        setAvatarUrl(profileRes.data.avatar_url);
      } else {
        setEmail(user.email || "");
      }

      setResumeCount(resumesRes.count || 0);
      setAnalysisCount(analysesRes.count || 0);
      setGeneratedCount(generatedRes.count || 0);
    };
    load();
  }, [user]);

  // Load transactions
  useEffect(() => {
    if (!user?.id) return;
    setTxLoading(true);
    Promise.all([
      supabase.from("payment_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("point_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]).then(([ordersRes, pointsRes]) => {
      setOrders((ordersRes.data as PaymentOrder[]) || []);
      const pts = (pointsRes.data as PointTransaction[]) || [];
      setPointsTxns(pts);
      setBalance(pts.reduce((s, t) => s + t.amount, 0));
      setTxLoading(false);
    });
  }, [user?.id]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      display_name: name.trim() || null,
      phone: phone.trim() || null,
      language,
      company_name: isRecruiter ? companyName.trim() || null : null,
      job_title: isRecruiter ? jobTitle.trim() || null : null,
      onboarding_completed: isRecruiter ? true : undefined,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await refetch();
    if (isRecruiter) switchView("recruiter");
    toast.success(isAr ? "تم حفظ الملف الشخصي والإعدادات" : "Profile and account settings saved");
  };

  const fmt = (d: string) => {
    try { return format(new Date(d), "dd MMM yyyy, hh:mm a", isAr ? { locale: arLocale } : undefined); }
    catch { return d; }
  };

  const fmtAmount = (cents: number, currency: string) => {
    const val = (cents / 100).toFixed(2);
    return currency === "SAR" ? `${val} ${isAr ? "ر.س" : "SAR"}` : `${val} ${currency}`;
  };

  const stats = [
    { label: t.dashboard.myResumes, value: resumeCount },
    { label: t.dashboard.myAnalyses, value: analysisCount },
    { label: t.dashboard.myGenerated, value: generatedCount },
  ];

  const backPath = isRecruiter ? "/recruiter/dashboard" : "/dashboard";
  const totalPaid = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.amount_cents, 0);
  const totalPointsPurchased = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.points, 0);

  return (
    <div className="min-h-screen bg-background" dir={isAr ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="container flex items-center gap-4 h-16">
          <Button variant="ghost" size="icon" asChild>
            <Link to={backPath}><ArrowLeft size={18} /></Link>
          </Button>
          <Link to={backPath} className="font-display text-lg font-bold text-foreground">
            TALEN<span className="text-primary">TRY</span>
          </Link>
          <span className="text-border/60 hidden sm:inline">/</span>
          <h1 className="font-display font-semibold text-foreground text-sm hidden sm:block">
            {isAr ? "الملف الشخصي وإعدادات الحساب" : "Profile & Account Settings"}
          </h1>
        </div>
      </header>

      <main className="container py-8 md:py-12 max-w-3xl space-y-6">
        {/* Avatar + name */}
        <div className="flex flex-col items-center mb-2">
          <div className="relative mb-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-24 h-24 rounded-full object-cover border-2 border-primary/20" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={36} className="text-primary" />
              </div>
            )}
          </div>
          <h2 className="font-display font-semibold text-lg text-foreground">{name || t.profile.yourProfile}</h2>
          <p className="text-sm text-muted-foreground font-body">{email}</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <BadgeCheck size={14} className="text-primary" />
            <span>
              {isRecruiter
                ? isAr ? "حساب مسؤول توظيف" : "Recruiter Account"
                : isAr ? "حساب باحث عن عمل" : "Job Seeker Account"}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="text-center p-3 bg-card rounded-xl border border-border">
              <p className="text-2xl font-display font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground font-body mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs: Profile + Transactions */}
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              {isAr ? "الملف الشخصي" : "Profile"}
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2">
              <Receipt className="h-4 w-4" />
              {isAr ? "سجل المعاملات" : "Transactions"}
            </TabsTrigger>
          </TabsList>

          {/* ── Profile Tab ── */}
          <TabsContent value="profile">
            <div className="space-y-5 p-6 bg-card rounded-xl border border-border">
              <div>
                <h3 className="font-display font-semibold text-foreground text-base">
                  {isAr ? "بيانات المستخدم" : "User Information"}
                </h3>
                <p className="text-sm text-muted-foreground font-body mt-1">
                  {isAr ? "اسم المستخدم وبيانات الحساب الأساسية" : "Username and essential account details"}
                </p>
              </div>

              <div>
                <label className="text-sm font-display font-medium text-foreground mb-1.5 flex items-center gap-2">
                  <User size={14} className="text-muted-foreground" /> {t.profile.name}
                </label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
              </div>

              <div>
                <label className="text-sm font-display font-medium text-foreground mb-1.5 flex items-center gap-2">
                  <Mail size={14} className="text-muted-foreground" /> {t.profile.email}
                </label>
                <Input value={email} disabled className="bg-background opacity-60" />
              </div>

              <div>
                <label className="text-sm font-display font-medium text-foreground mb-1.5 flex items-center gap-2">
                  <Phone size={14} className="text-muted-foreground" /> {t.profile.phone}
                </label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966 5XX XXX XXXX" className="bg-background" />
              </div>

              {isRecruiter && (
                <>
                  <div className="pt-2 border-t border-border" />
                  <div>
                    <h3 className="font-display font-semibold text-foreground text-base">
                      {isAr ? "بيانات الشركة والتوظيف" : "Company & Hiring Details"}
                    </h3>
                  </div>
                  <div>
                    <label className="text-sm font-display font-medium text-foreground mb-1.5 flex items-center gap-2">
                      <Building2 size={14} className="text-muted-foreground" /> {isAr ? "اسم الشركة" : "Company Name"}
                    </label>
                    <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="bg-background" />
                  </div>
                  <div>
                    <label className="text-sm font-display font-medium text-foreground mb-1.5 flex items-center gap-2">
                      <Briefcase size={14} className="text-muted-foreground" /> {isAr ? "المسمى الوظيفي" : "Job Title"}
                    </label>
                    <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="bg-background" />
                  </div>
                </>
              )}

              <div className="pt-2 border-t border-border" />
              <div>
                <label className="text-sm font-display font-medium text-foreground mb-1.5 flex items-center gap-2">
                  <Globe size={14} className="text-muted-foreground" /> {t.profile.language}
                </label>
                <div className="flex gap-2">
                  <Button variant={language === "en" ? "default" : "outline"} size="sm" onClick={() => setLanguage("en")}>English</Button>
                  <Button variant={language === "ar" ? "default" : "outline"} size="sm" onClick={() => setLanguage("ar")}>العربية</Button>
                </div>
              </div>

              <Button className="w-full mt-2" onClick={handleSave} disabled={saving}>
                {saving ? t.common.loading : isAr ? "حفظ الملف الشخصي والإعدادات" : "Save Profile & Settings"}
              </Button>
            </div>
          </TabsContent>

          {/* ── Transactions Tab ── */}
          <TabsContent value="transactions">
            {txLoading ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
                <Skeleton className="h-64" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  <Card className="border-primary/20">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="rounded-xl bg-primary/10 p-2.5"><Coins className="h-5 w-5 text-primary" /></div>
                      <div>
                        <p className="text-xs text-muted-foreground">{isAr ? "الرصيد" : "Balance"}</p>
                        <p className="text-xl font-bold text-foreground">{balance}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="rounded-xl bg-emerald-500/10 p-2.5"><CreditCard className="h-5 w-5 text-emerald-600" /></div>
                      <div>
                        <p className="text-xs text-muted-foreground">{isAr ? "المدفوع" : "Paid"}</p>
                        <p className="text-xl font-bold text-foreground">{fmtAmount(totalPaid, "SAR")}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="rounded-xl bg-blue-500/10 p-2.5"><Receipt className="h-5 w-5 text-blue-600" /></div>
                      <div>
                        <p className="text-xs text-muted-foreground">{isAr ? "نقاط مشتراة" : "Purchased"}</p>
                        <p className="text-xl font-bold text-foreground">{totalPointsPurchased}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sub-tabs: Payments / Points */}
                <Tabs defaultValue="payments" className="space-y-3">
                  <TabsList>
                    <TabsTrigger value="payments" className="gap-2">
                      <CreditCard className="h-3.5 w-3.5" />
                      {isAr ? "المدفوعات" : "Payments"}
                    </TabsTrigger>
                    <TabsTrigger value="points" className="gap-2">
                      <Coins className="h-3.5 w-3.5" />
                      {isAr ? "حركة النقاط" : "Points"}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="payments">
                    <Card>
                      <CardContent className="p-4">
                        {orders.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">{isAr ? "لا توجد عمليات دفع" : "No payments yet"}</p>
                        ) : (
                          <div className="divide-y divide-border">
                            {orders.map((o) => {
                              const cfg = statusConfig[o.status] || statusConfig.pending;
                              const Icon = cfg.icon;
                              return (
                                <div key={o.id} className="flex items-center justify-between py-3.5 gap-3 flex-wrap">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="rounded-lg bg-muted p-2 shrink-0"><CreditCard className="h-4 w-4 text-muted-foreground" /></div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">{o.package_name}</p>
                                      <p className="text-xs text-muted-foreground">{fmt(o.created_at)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-end">
                                      <p className="text-sm font-semibold">{fmtAmount(o.amount_cents, o.currency)}</p>
                                      <p className="text-xs text-muted-foreground">+{o.points} {isAr ? "نقطة" : "pts"}</p>
                                    </div>
                                    <Badge variant="outline" className={`gap-1 text-[11px] ${cfg.color}`}>
                                      <Icon className="h-3 w-3" />
                                      {isAr ? cfg.labelAr : cfg.labelEn}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="points">
                    <Card>
                      <CardContent className="p-4">
                        {pointsTxns.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">{isAr ? "لا توجد حركات" : "No activity yet"}</p>
                        ) : (
                          <div className="divide-y divide-border">
                            {pointsTxns.map((tx) => {
                              const isCredit = tx.amount > 0;
                              return (
                                <div key={tx.id} className="flex items-center justify-between py-3.5 gap-3 flex-wrap">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`rounded-lg p-2 shrink-0 ${isCredit ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                                      {isCredit ? <ArrowDownCircle className="h-4 w-4 text-emerald-600" /> : <ArrowUpCircle className="h-4 w-4 text-red-500" />}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">{tx.description || tx.type}</p>
                                      <p className="text-xs text-muted-foreground">{fmt(tx.created_at)}</p>
                                    </div>
                                  </div>
                                  <span className={`text-sm font-bold shrink-0 ${isCredit ? "text-emerald-600" : "text-red-500"}`}>
                                    {isCredit ? "+" : ""}{tx.amount}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Profile;


