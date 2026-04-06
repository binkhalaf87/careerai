import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  MessageSquareText,
  Loader2,
  Trash2,
  Plus,
  Edit,
  Send,
  Mail,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  Brain,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";

interface QuestionSet {
  id: string;
  title: string;
  questions: any[];
  created_at: string;
  candidate_id: string | null;
}

interface Question {
  category: string;
  question: string;
  why_it_matters: string;
  strong_answer_signals: string;
}

interface CandidateInfo {
  id: string;
  name: string;
  email: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  technical: "bg-blue-100 text-blue-700",
  behavioral: "bg-purple-100 text-purple-700",
  cultural: "bg-green-100 text-green-700",
  situational: "bg-orange-100 text-orange-700",
  motivational: "bg-yellow-100 text-yellow-700",
  custom: "bg-gray-100 text-gray-700",
};

const RecruiterQuestions = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const ar = language === "ar";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const candidateIdFromUrl = searchParams.get("candidate");
  const candidateNameFromUrl = searchParams.get("name");

  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editSet, setEditSet] = useState<QuestionSet | null>(null);
  const [editQuestions, setEditQuestions] = useState<Question[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [candidateMap, setCandidateMap] = useState<Record<string, CandidateInfo>>({});
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [emailDialogSet, setEmailDialogSet] = useState<QuestionSet | null>(null);
  const [emailBody, setEmailBody] = useState("");
  const [generatingForCandidate, setGeneratingForCandidate] = useState(false);
  const [generatedTriggered, setGeneratedTriggered] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("recruiter_question_sets")
      .select("id, title, questions, created_at, candidate_id")
      .eq("recruiter_id", user.id)
      .order("created_at", { ascending: false });
    const normalizedSets = (data || []).map((d: any) => ({
      ...d,
      questions: Array.isArray(d.questions) ? d.questions : [],
    }));
    setSets(normalizedSets);

    const candidateIds = [
      ...new Set(normalizedSets.filter((s) => s.candidate_id).map((s) => s.candidate_id as string)),
    ];
    if (candidateIds.length > 0) {
      const { data: candidates } = await supabase
        .from("recruiter_candidates")
        .select("id, name, email")
        .in("id", candidateIds);
      const map: Record<string, CandidateInfo> = {};
      (candidates || []).forEach((c: any) => {
        map[c.id] = c;
      });
      setCandidateMap(map);
    }

    setLoading(false);
    return normalizedSets;
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-expand set for candidate from URL
  useEffect(() => {
    if (candidateIdFromUrl && sets.length > 0) {
      const match = sets.find((s) => s.candidate_id === candidateIdFromUrl);
      if (match) setExpandedId(match.id);
    }
  }, [candidateIdFromUrl, sets]);

  // Auto-generate if routed from AI Interview button and no set exists
  useEffect(() => {
    if (!candidateIdFromUrl || !user || loading || generatedTriggered) return;
    const exists = sets.some((s) => s.candidate_id === candidateIdFromUrl);
    if (!exists) {
      setGeneratedTriggered(true);
      handleGenerateForCandidate(candidateIdFromUrl);
    }
  }, [candidateIdFromUrl, sets, loading, generatedTriggered]);

  const handleGenerateForCandidate = async (candidateId: string) => {
    if (!user) return;
    const { data: cand } = await supabase
      .from("recruiter_candidates")
      .select("id, name, current_title, extracted_text, email")
      .eq("id", candidateId)
      .single();
    if (!cand?.extracted_text) {
      toast.error(ar ? "لا يوجد نص مستخرج من السيرة الذاتية" : "No resume text found for this candidate");
      return;
    }
    setGeneratingForCandidate(true);
    toast.info(ar ? "جاري إنشاء أسئلة المقابلة..." : "Generating interview questions...");
    try {
      const { data, error } = await supabase.functions.invoke("recruiter-generate-questions", {
        body: {
          candidateText: cand.extracted_text,
          candidateName: cand.name,
          candidateTitle: cand.current_title,
          language,
        },
      });
      if (error) throw error;
      const questions = data?.questions;
      if (questions) {
        const { data: inserted } = await supabase
          .from("recruiter_question_sets")
          .insert({
            recruiter_id: user.id,
            candidate_id: candidateId,
            title: `${cand.name} - Interview Questions`,
            questions,
          })
          .select("id")
          .single();
        toast.success(ar ? "تم إنشاء الأسئلة" : "Questions generated");
        const fresh = await load();
        if (inserted) setExpandedId(inserted.id);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate questions");
    } finally {
      setGeneratingForCandidate(false);
    }
  };

  const openEdit = (set: QuestionSet) => {
    setEditSet(set);
    setEditQuestions([...set.questions]);
  };

  const saveEdit = async () => {
    if (!editSet) return;
    await supabase
      .from("recruiter_question_sets")
      .update({ questions: editQuestions as any })
      .eq("id", editSet.id);
    toast.success(ar ? "تم الحفظ" : "Saved");
    setEditSet(null);
    load();
  };

  const updateQuestion = (idx: number, field: keyof Question, value: string) => {
    setEditQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  };

  const removeQuestion = (idx: number) => {
    setEditQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const addQuestion = () => {
    setEditQuestions((prev) => [
      ...prev,
      {
        category: "custom",
        question: "",
        why_it_matters: "",
        strong_answer_signals: "",
      },
    ]);
  };

  const deleteSet = async (id: string) => {
    await supabase.from("recruiter_question_sets").delete().eq("id", id);
    toast.success(ar ? "تم الحذف" : "Deleted");
    load();
  };

  const openEmailDialog = (set: QuestionSet) => {
    const candidate = set.candidate_id ? candidateMap[set.candidate_id] : null;
    const questionsText = set.questions.map((q: any, i: number) => `${i + 1}. ${q.question}`).join("\n");
    setEmailBody(
      ar
        ? `السلام عليكم ${candidate?.name || ""},\n\nيسعدنا دعوتك لمقابلة عمل. فيما يلي أسئلة المقابلة للتحضير:\n\n${questionsText}\n\nنتطلع إلى لقائك قريباً.\n\nمع التحية`
        : `Dear ${candidate?.name || "Candidate"},\n\nWe'd like to invite you for an interview. Here are the questions to help you prepare:\n\n${questionsText}\n\nLooking forward to speaking with you.\n\nBest regards`,
    );
    setEmailDialogSet(set);
  };

  const sendEmail = async () => {
    if (!emailDialogSet) return;
    const candidate = emailDialogSet.candidate_id ? candidateMap[emailDialogSet.candidate_id] : null;
    if (!candidate?.email) {
      toast.error(ar ? "لا يوجد بريد إلكتروني للمرشح" : "No email found for this candidate");
      return;
    }
    setSendingEmail(emailDialogSet.id);
    try {
      const subject = encodeURIComponent(ar ? "دعوة مقابلة عمل" : "Interview Invitation");
      const body = encodeURIComponent(emailBody);
      window.open(`mailto:${candidate.email}?subject=${subject}&body=${body}`, "_blank");
      toast.success(ar ? "تم فتح تطبيق البريد الإلكتروني" : "Email client opened");
      setEmailDialogSet(null);
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setSendingEmail(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const categoryColor = (cat: string) => CATEGORY_COLORS[cat?.toLowerCase()] || "bg-gray-100 text-gray-700";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">
            {ar ? "أسئلة المقابلة" : "Interview Questions"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ar ? "مجموعات أسئلة مخصصة لكل مرشح" : "Tailored question sets per candidate"}
          </p>
        </div>
        {candidateIdFromUrl && (
          <Button variant="outline" size="sm" onClick={() => navigate(`/recruiter/candidates/${candidateIdFromUrl}`)}>
            <User size={13} className="mr-1.5" />
            {ar ? "العودة للمرشح" : "Back to Candidate"}
          </Button>
        )}
      </div>

      {/* Generating indicator */}
      {generatingForCandidate && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {ar
                  ? `جاري إنشاء أسئلة لـ ${candidateNameFromUrl || "المرشح"}...`
                  : `Generating questions for ${candidateNameFromUrl || "candidate"}...`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ar
                  ? "يحلل AI السيرة الذاتية لإنشاء أسئلة مخصصة"
                  : "AI is analyzing the resume to craft targeted questions"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : sets.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquareText className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            {ar ? "لا توجد أسئلة بعد" : "No question sets yet"}
          </p>
          <p className="text-xs text-muted-foreground">
            {ar
              ? "اضغط على زر «مقابلة AI» في صفحة المرشحين لإنشاء أسئلة."
              : 'Click "AI Interview" on a candidate card to generate questions.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sets.map((s) => {
            const candidate = s.candidate_id ? candidateMap[s.candidate_id] : null;
            const isExpanded = expandedId === s.id;
            const isHighlighted = !!candidateIdFromUrl && s.candidate_id === candidateIdFromUrl;

            return (
              <Card
                key={s.id}
                className={`overflow-hidden transition-all ${isHighlighted ? "ring-2 ring-primary/40" : ""}`}
              >
                {/* Card Header — clickable to expand */}
                <div
                  className="p-4 cursor-pointer select-none hover:bg-muted/20 transition-colors"
                  onClick={() => toggleExpand(s.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-display font-semibold text-foreground">{s.title}</h3>
                        {isHighlighted && (
                          <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                            {ar ? "محدد" : "Selected"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {candidate && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User size={11} />
                            {candidate.name}
                            {candidate.email && <span className="text-primary/70">— {candidate.email}</span>}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar size={11} />
                          {new Date(s.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Brain size={11} />
                          {s.questions.length} {ar ? "سؤال" : "questions"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Category pills preview */}
                      <div className="hidden sm:flex gap-1 flex-wrap">
                        {[...new Set(s.questions.map((q: any) => q.category))].slice(0, 3).map((cat) => (
                          <span
                            key={cat}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryColor(cat)}`}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-muted-foreground" />
                      ) : (
                        <ChevronDown size={16} className="text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Questions List */}
                {isExpanded && (
                  <div className="border-t border-border">
                    <div className="p-4 space-y-2.5">
                      {s.questions.map((q: any, i: number) => (
                        <div key={i} className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2">
                          <div className="flex items-start gap-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${categoryColor(
                                q.category,
                              )}`}
                            >
                              {q.category}
                            </span>
                            <p className="text-sm font-medium text-foreground leading-relaxed">{q.question}</p>
                          </div>
                          {q.why_it_matters && (
                            <div className="flex items-start gap-1.5 text-xs text-muted-foreground pl-1">
                              <Lightbulb size={11} className="mt-0.5 text-yellow-500 shrink-0" />
                              <span>{q.why_it_matters}</span>
                            </div>
                          )}
                          {q.strong_answer_signals && (
                            <div className="flex items-start gap-1.5 text-xs text-muted-foreground pl-1">
                              <CheckCircle2 size={11} className="mt-0.5 text-green-500 shrink-0" />
                              <span>{q.strong_answer_signals}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="px-4 pb-4 flex flex-wrap gap-2 border-t border-border pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(s);
                        }}
                      >
                        <Edit size={12} className="mr-1.5" /> {ar ? "تعديل" : "Edit"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEmailDialog(s);
                        }}
                        disabled={!candidate?.email}
                        title={!candidate?.email ? (ar ? "لا يوجد بريد إلكتروني" : "No email for this candidate") : ""}
                      >
                        <Mail size={12} className="mr-1.5" />
                        {ar ? "إرسال للمرشح" : "Send to Candidate"}
                      </Button>
                      {candidate && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/recruiter/candidates/${candidate.id}`);
                          }}
                        >
                          <User size={12} className="mr-1.5" />
                          {ar ? "ملف المرشح" : "View Profile"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive ml-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSet(s.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editSet} onOpenChange={() => setEditSet(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{ar ? "تعديل الأسئلة" : "Edit Questions"}</DialogTitle>
            <DialogDescription>
              {ar ? "عدّل أو أضف أسئلة المقابلة" : "Edit or add interview questions"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {editQuestions.map((q, i) => (
              <Card key={i} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryColor(q.category)}`}>
                    {q.category}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => removeQuestion(i)}>
                    <Trash2 size={12} className="text-destructive" />
                  </Button>
                </div>
                <Textarea
                  value={q.question}
                  onChange={(e) => updateQuestion(i, "question", e.target.value)}
                  placeholder={ar ? "السؤال" : "Question"}
                  rows={2}
                  className="bg-card text-sm"
                />
                <Input
                  value={q.why_it_matters}
                  onChange={(e) => updateQuestion(i, "why_it_matters", e.target.value)}
                  placeholder={ar ? "لماذا هذا مهم" : "Why it matters"}
                  className="bg-card text-xs"
                />
                <Input
                  value={q.strong_answer_signals}
                  onChange={(e) => updateQuestion(i, "strong_answer_signals", e.target.value)}
                  placeholder={ar ? "مؤشرات الإجابة القوية" : "Strong answer signals"}
                  className="bg-card text-xs"
                />
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={addQuestion} className="w-full">
              <Plus size={14} className="mr-1.5" /> {ar ? "إضافة سؤال" : "Add Question"}
            </Button>
            <Button onClick={saveEdit} className="w-full">
              {ar ? "حفظ التغييرات" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={!!emailDialogSet} onOpenChange={() => setEmailDialogSet(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail size={16} className="text-primary" />
              {ar ? "إرسال الأسئلة للمرشح" : "Send Questions to Candidate"}
            </DialogTitle>
            <DialogDescription>
              {emailDialogSet?.candidate_id && candidateMap[emailDialogSet.candidate_id]?.email ? (
                <span className="text-primary font-medium">{candidateMap[emailDialogSet.candidate_id]?.email}</span>
              ) : ar ? (
                "يرجى مراجعة الرسالة قبل الإرسال"
              ) : (
                "Review the message before sending"
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={12}
              className="bg-card text-sm font-mono"
              placeholder={ar ? "نص الرسالة..." : "Message body..."}
            />
            <div className="flex gap-2">
              <Button onClick={sendEmail} className="flex-1" disabled={sendingEmail === emailDialogSet?.id}>
                {sendingEmail === emailDialogSet?.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Send size={13} className="mr-1.5" />
                )}
                {ar ? "فتح تطبيق البريد" : "Open Email Client"}
              </Button>
              <Button variant="outline" onClick={() => setEmailDialogSet(null)}>
                {ar ? "إلغاء" : "Cancel"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              {ar
                ? "سيتم فتح تطبيق البريد الإلكتروني مع الرسالة جاهزة للإرسال"
                : "Your email client will open with the message pre-filled"}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecruiterQuestions;
