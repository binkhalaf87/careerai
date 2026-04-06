import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ActionButton {
  route: string;
  label: string;
}

interface UserContext {
  hasResume: boolean;
  hasAnalysis: boolean;
  atsScore: number | null;
  jobTitle: string | null;
  skills: string | null;
  hasEnhanced: boolean;
  hasSearchedJobs: boolean;
}

// ── FAQ Fallback ───────────────────────────────────────────────────────────
const FAQ: Record<string, { answer: string; actions: ActionButton[] }> = {
  "how do i upload my cv": {
    answer: "Go to your Dashboard and click the upload area or the 'Upload CV' button. We support PDF and DOCX files up to 20MB.",
    actions: [{ route: "/dashboard", label: "Go to Dashboard" }],
  },
  "how does analysis work": {
    answer: "After uploading your CV, click 'Analyze'. Our AI scores your resume on ATS compatibility (0–100), checking sections like contact info, experience, skills, and formatting.",
    actions: [{ route: "/analysis", label: "Analyze My CV" }],
  },
  "how does smart apply work": {
    answer: "On the Job Search page, find a job you like and click 'Smart Apply'. We generate a tailored cover letter based on your resume and the job description.",
    actions: [{ route: "/job-search", label: "Find Jobs" }],
  },
  "how to send applications": {
    answer: "Use SmartSend (Marketing) to generate professional outreach emails. You can connect your Gmail to send them directly from the platform.",
    actions: [{ route: "/marketing", label: "Open SmartSend" }],
  },
};

function findFaqMatch(query: string): (typeof FAQ)[string] | null {
  const lower = query.toLowerCase().trim();
  for (const [key, value] of Object.entries(FAQ)) {
    if (lower.includes(key) || key.includes(lower)) return value;
  }
  return null;
}

// ── Parse action buttons from AI response ──────────────────────────────────
function parseActions(text: string): { cleanText: string; actions: ActionButton[] } {
  const actions: ActionButton[] = [];
  const cleanText = text.replace(/\[ACTION:([^\]]+):([^\]]+)\]/g, (_, route, label) => {
    actions.push({ route: route.trim(), label: label.trim() });
    return "";
  }).trim();
  return { cleanText, actions };
}

// ── Quick suggestions ──────────────────────────────────────────────────────
const QUICK_SUGGESTIONS = [
  "How do I use Talentry?",
  "Improve my CV",
  "Find jobs for me",
  "Why is my match score low?",
];

// ── Streaming helper ───────────────────────────────────────────────────────
async function streamChat({
  messages,
  userContext,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  userContext: UserContext;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ messages, userContext }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    onError(body.error || "Something went wrong. Please try again.");
    return;
  }

  if (!resp.body) {
    onError("No response received.");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") break;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        /* partial JSON, skip */
      }
    }
  }
  onDone();
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AIChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userCtx, setUserCtx] = useState<UserContext>({
    hasResume: false, hasAnalysis: false, atsScore: null,
    jobTitle: null, skills: null, hasEnhanced: false, hasSearchedJobs: false,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load user context once on open
  useEffect(() => {
    if (!open || !user?.id) return;
    (async () => {
      try {
        const [resumeRes, analysisRes, enhancedRes, jobSearchRes] = await Promise.all([
          supabase.from("user_resumes" as never).select("detected_job_title, detected_skills").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
          supabase.from("analyses").select("overall_score").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
          supabase.from("generated_resumes").select("id").eq("user_id", user.id).limit(1),
          supabase.from("job_search_history").select("id").eq("user_id", user.id).limit(1),
        ]);
        const resume = Array.isArray(resumeRes.data) && resumeRes.data.length > 0 ? resumeRes.data[0] as any : null;
        const analysis = Array.isArray(analysisRes.data) && analysisRes.data.length > 0 ? analysisRes.data[0] : null;
        setUserCtx({
          hasResume: !!resume,
          hasAnalysis: !!analysis,
          atsScore: analysis?.overall_score ?? null,
          jobTitle: resume?.detected_job_title ?? null,
          skills: resume?.detected_skills ?? null,
          hasEnhanced: Array.isArray(enhancedRes.data) && enhancedRes.data.length > 0,
          hasSearchedJobs: Array.isArray(jobSearchRes.data) && jobSearchRes.data.length > 0,
        });
      } catch { /* use defaults */ }
    })();
  }, [open, user?.id]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // FAQ fallback check
    const faq = findFaqMatch(text);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        userContext: userCtx,
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
        onError: (errMsg) => {
          // Fallback to FAQ if AI fails
          if (faq) {
            setMessages(prev => [...prev, { role: "assistant", content: faq.answer + "\n" + faq.actions.map(a => `[ACTION:${a.route}:${a.label}]`).join(" ") }]);
          } else {
            setMessages(prev => [...prev, { role: "assistant", content: errMsg }]);
          }
          setIsLoading(false);
        },
      });
    } catch {
      if (faq) {
        setMessages(prev => [...prev, { role: "assistant", content: faq.answer + "\n" + faq.actions.map(a => `[ACTION:${a.route}:${a.label}]`).join(" ") }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "I'm having trouble connecting. Please try again." }]);
      }
      setIsLoading(false);
    }
  }, [messages, isLoading, userCtx]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-105",
          "h-14 w-14 bg-primary text-primary-foreground",
          open && "rotate-90"
        )}
        aria-label="AI Assistant"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex flex-col w-[380px] max-w-[calc(100vw-2.5rem)] h-[520px] max-h-[calc(100vh-8rem)] rounded-2xl border border-border bg-card shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-primary/5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">T</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">Talentry Assistant</p>
              <p className="text-[11px] text-muted-foreground">AI-powered career guide</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Welcome */}
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-xl bg-muted/60 px-3.5 py-3 text-sm text-foreground">
                  Hi 👋 I'm your AI Career Assistant. I can help you improve your CV, find jobs, and apply smarter.
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              if (msg.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2.5 text-sm">
                      {msg.content}
                    </div>
                  </div>
                );
              }
              const { cleanText, actions } = parseActions(msg.content);
              return (
                <div key={i} className="space-y-2">
                  <div className="max-w-[90%] rounded-xl rounded-bl-sm bg-muted/60 px-3.5 py-2.5 text-sm text-foreground whitespace-pre-wrap">
                    {cleanText}
                  </div>
                  {actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {actions.map((a, j) => (
                        <button
                          key={j}
                          onClick={() => { navigate(a.route); setOpen(false); }}
                          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          {a.label} <ChevronRight size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 size={14} className="animate-spin" /> Thinking...
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2.5 border-t border-border bg-card">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" variant="ghost" disabled={!input.trim() || isLoading} className="h-8 w-8 shrink-0">
              <Send size={16} />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
