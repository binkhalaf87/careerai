/**
 * TALENTRY — calculate-matches Edge Function
 * Weights: Skills 40% | Experience 25% | Title 20% | Keywords 15%
 *
 * Verified schema:
 *   recruiter_jobs:       id, title, description, required_skills[], preferred_skills[],
 *                         minimum_experience_years, recruiter_id
 *   recruiter_candidates: id, current_title, extracted_skills[], extracted_experience_years,
 *                         experience_years, extracted_text, structured_data, recruiter_id
 *   recruiter_candidate_job_matches: id, candidate_id, job_id, recruiter_id,
 *                         match_score, title_score, skills_score, experience_score,
 *                         keyword_score, match_reasons, updated_at, created_at
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const W_SKILLS = 0.4;
const W_EXPERIENCE = 0.25;
const W_TITLE = 0.2;
const W_KEYWORDS = 0.15;
const BATCH_SIZE = 100;
const MAX_CANDS = 500;
const STALE_HOURS = 24;

// ─── Synonym map ──────────────────────────────────────────────────────────────
const SYNONYMS: Record<string, string[]> = {
  "software engineer": ["developer", "programmer", "swe", "software developer", "coder"],
  frontend: ["front-end", "front end", "ui developer", "react developer", "vue developer", "angular developer"],
  backend: ["back-end", "back end", "server-side", "api developer", "node developer"],
  fullstack: ["full-stack", "full stack", "full-stack developer"],
  mobile: ["ios developer", "android developer", "react native", "flutter developer"],
  devops: ["site reliability", "sre", "infrastructure engineer", "platform engineer", "cloud engineer"],
  "data scientist": ["ml engineer", "machine learning", "ai engineer", "research engineer"],
  "data engineer": ["etl developer", "pipeline engineer", "big data"],
  "product manager": ["pm", "product owner", "po", "program manager"],
  ux: ["ui/ux", "user experience", "product designer", "interaction designer"],
  qa: ["quality assurance", "test engineer", "sdet", "automation engineer", "tester"],
  security: ["cybersecurity", "infosec", "penetration tester", "security analyst"],
  hr: ["human resources", "people operations", "talent acquisition", "recruiter"],
  sales: ["account executive", "ae", "business development", "bdr", "sdr", "account manager"],
  marketing: ["digital marketing", "growth marketer", "content marketer", "seo"],
  finance: ["accountant", "financial analyst", "controller", "fp&a"],
  manager: ["lead", "head", "director", "vp", "supervisor", "team lead"],
  senior: ["sr", "sr.", "principal", "staff"],
  junior: ["jr", "jr.", "entry level", "associate", "intern", "graduate"],
  architect: ["solutions architect", "system architect", "technical lead", "tech lead"],
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "with",
  "this",
  "that",
  "from",
  "have",
  "will",
  "your",
  "they",
  "been",
  "more",
  "about",
  "into",
  "some",
  "than",
  "them",
  "very",
  "when",
  "what",
  "there",
  "their",
  "each",
  "which",
  "also",
  "should",
  "would",
  "could",
  "may",
  "can",
  "not",
  "but",
  "our",
  "we",
  "you",
  "he",
  "she",
  "it",
  "at",
  "by",
  "an",
  "a",
  "of",
  "in",
  "to",
  "is",
  "on",
  "as",
  "be",
  "do",
  "if",
  "or",
  "all",
  "has",
  "its",
  "who",
  "one",
  "had",
  "was",
]);

// ─── Utilities ────────────────────────────────────────────────────────────────

function norm(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return norm(text)
    .split(" ")
    .filter((w) => w.length > 1);
}

function expandToken(t: string): Set<string> {
  const out = new Set<string>([t]);
  for (const [canon, syns] of Object.entries(SYNONYMS)) {
    if ([canon, ...syns].includes(t)) {
      out.add(canon);
      syns.forEach((s) => out.add(s));
    }
  }
  return out;
}

function levenshteinSim(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length < b.length ? a : b;
  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let last = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let nv = costs[j - 1];
        if (shorter[i - 1] !== longer[j - 1]) nv = Math.min(nv, last, costs[j]) + 1;
        costs[j - 1] = last;
        last = nv;
      }
    }
    if (i > 0) costs[longer.length] = last;
  }
  return (longer.length - costs[longer.length]) / longer.length;
}

function bigramSim(a: string, b: string): number {
  const bg = (s: string) => {
    const t = tokenize(s);
    const set = new Set<string>();
    for (let i = 0; i < t.length - 1; i++) set.add(`${t[i]} ${t[i + 1]}`);
    return set;
  };
  const s1 = bg(a),
    s2 = bg(b);
  if (!s1.size || !s2.size) return 0;
  let common = 0;
  for (const bg of s1) if (s2.has(bg)) common++;
  return (2 * common) / (s1.size + s2.size);
}

function extractKeywords(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of tokenize(text)) {
    if (!STOP_WORDS.has(t) && t.length > 2) out.add(t);
  }
  return out;
}

// ─── Scorers ──────────────────────────────────────────────────────────────────

function scoreTitle(jobTitle: string, candTitle: string, candText: string): { score: number; reason: string } {
  if (!jobTitle) return { score: 25, reason: "Job title unavailable" };

  const jn = norm(jobTitle);

  // 1) Direct title comparison (if available)
  let titleSim = 0;
  if (candTitle) {
    const cn = norm(candTitle);
    if (jn === cn) return { score: 100, reason: `Exact title match: "${candTitle}"` };
    if (jn.includes(cn) || cn.includes(jn)) titleSim = 0.88;
    else {
      const jExp = new Set<string>(), cExp = new Set<string>();
      tokenize(jobTitle).forEach((t) => expandToken(t).forEach((e) => jExp.add(e)));
      tokenize(candTitle).forEach((t) => expandToken(t).forEach((e) => cExp.add(e)));
      let overlap = 0;
      for (const t of cExp) if (jExp.has(t)) overlap++;
      const union = new Set([...jExp, ...cExp]).size;
      const jaccard = union > 0 ? overlap / union : 0;
      const bigram = bigramSim(jobTitle, candTitle);
      const lev = jn.length < 40 && cn.length < 40 ? levenshteinSim(jn, cn) * 0.7 : 0;
      titleSim = Math.max(jaccard, bigram, lev);
    }
  }

  // 2) Resume text relevance — search for job title tokens & synonyms in full CV text
  let textRelevance = 0;
  if (candText && candText.length > 30) {
    const cn = norm(candText);
    const jobTokens = tokenize(jobTitle);
    const expandedJobTokens = new Set<string>();
    jobTokens.forEach((t) => expandToken(t).forEach((e) => expandedJobTokens.add(e)));

    let found = 0;
    for (const tok of expandedJobTokens) {
      if (cn.includes(tok)) found++;
    }
    textRelevance = expandedJobTokens.size > 0 ? found / expandedJobTokens.size : 0;
  }

  // 3) Combine: weight title 40%, resume text 60% (so resume content matters more)
  const combined = candTitle
    ? titleSim * 0.4 + textRelevance * 0.6
    : textRelevance; // no title? rely entirely on resume text

  if (combined >= 0.7)
    return { score: Math.min(100, 75 + Math.round(combined * 25)), reason: `Strong role relevance based on resume content` };
  if (combined >= 0.45)
    return { score: 50 + Math.round(combined * 40), reason: `Good role alignment from resume experience` };
  if (combined >= 0.2)
    return { score: 20 + Math.round(combined * 40), reason: `Some relevance to "${jobTitle}" found in resume` };
  return { score: 5, reason: candTitle ? `Low relevance: "${candTitle}" vs "${jobTitle}"` : `Resume content doesn't match "${jobTitle}"` };
}

function scoreSkills(
  required: string[],
  preferred: string[],
  candidate: string[],
): { score: number; reasons: string[] } {
  if (!required.length && !preferred.length)
    return { score: 55, reasons: ["No specific skills required for this role"] };
  if (!candidate.length) return { score: 10, reasons: ["No skills extracted from candidate profile"] };

  const candNorm = candidate.map(norm);
  const match = (skill: string) => {
    const sn = norm(skill);
    return candNorm.some((cs) => cs === sn || cs.includes(sn) || sn.includes(cs) || levenshteinSim(cs, sn) > 0.85);
  };

  const matched: string[] = [],
    missing: string[] = [];
  for (const s of required) (match(s) ? matched : missing).push(s);
  const reqScore = required.length > 0 ? (matched.length / required.length) * 100 : 55;
  const prefMatch = preferred.filter(match).length;
  const prefScore = preferred.length > 0 ? (prefMatch / preferred.length) * 100 : 55;
  const score = Math.round(reqScore * 0.7 + prefScore * 0.3);

  const reasons: string[] = [];
  if (required.length > 0) reasons.push(`${matched.length}/${required.length} required skills matched`);
  if (matched.length > 0) reasons.push(`Matched: ${matched.slice(0, 5).join(", ")}`);
  if (missing.length > 0) reasons.push(`Missing: ${missing.slice(0, 3).join(", ")}`);
  if (preferred.length > 0 && prefMatch > 0) reasons.push(`${prefMatch}/${preferred.length} preferred skills matched`);
  return { score: Math.min(100, Math.max(0, score)), reasons };
}

function scoreExperience(required: number | null, candidate: number | null): { score: number; reason: string } {
  if (required == null && candidate == null) return { score: 50, reason: "Experience data unavailable" };
  if (required == null) return { score: 65, reason: `${candidate ?? "?"} yrs experience (no minimum set)` };
  if (candidate == null) return { score: 35, reason: `Job requires ${required}+ yrs; candidate data unknown` };

  const diff = candidate - required;
  if (diff >= 0)
    return {
      score: Math.min(100, 85 + Math.min(diff * 3, 15)),
      reason: `${candidate} yrs meets ${required}+ yrs requirement`,
    };
  if (diff >= -1) return { score: 65, reason: `${candidate} yrs — slightly below ${required} required` };
  if (diff >= -2) return { score: 45, reason: `${candidate} yrs — ${Math.abs(diff)} yrs below ${required}` };
  if (diff >= -4) return { score: 25, reason: `${candidate} yrs — significantly below ${required}` };
  return { score: 10, reason: `${candidate} yrs — well below ${required} required` };
}

function scoreKeywords(jobTitle: string, jobDesc: string, candText: string): { score: number; reason: string } {
  if (!candText || candText.length < 20)
    return { score: 15, reason: "Insufficient candidate text for keyword analysis" };
  if (!jobDesc && !jobTitle) return { score: 50, reason: "No job description available" };

  const jobKw = extractKeywords(`${jobTitle} ${jobDesc}`);
  if (jobKw.size === 0) return { score: 50, reason: "No meaningful keywords in job description" };

  const cn = norm(candText);
  let matched = 0;
  for (const kw of jobKw) if (cn.includes(kw)) matched++;

  const score = Math.round((matched / jobKw.size) * 100);
  return {
    score: Math.min(100, Math.max(0, score)),
    reason: `${matched}/${jobKw.size} keywords matched in candidate profile`,
  };
}

// ─── Composite ────────────────────────────────────────────────────────────────

interface MatchRow {
  candidate_id: string;
  job_id: string;
  recruiter_id: string;
  match_score: number;
  title_score: number;
  skills_score: number;
  experience_score: number;
  keyword_score: number;
  match_reasons: string[];
}

function parseCandidateSkills(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[;,\n•·|]/)
      : [];

  return [
    ...new Set(
      list
        .map((item) => String(item || "").trim().toLowerCase())
        .map((item) => item.replace(/^[-•*]+\s*/, ""))
        .filter(Boolean),
    ),
  ];
}

function parseCandidateExperience(cand: Record<string, unknown>, candText: string): number | null {
  const direct = cand.extracted_experience_years != null ? cand.extracted_experience_years : cand.experience_years;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  if (typeof direct === "string") {
    const parsed = parseFloat(direct.replace(/[^\d.]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }

  if (cand.structured_data) {
    try {
      const sd = typeof cand.structured_data === "string"
        ? JSON.parse(cand.structured_data as string)
        : (cand.structured_data as Record<string, unknown>);
      const candidateYears =
        sd.experience_years ?? sd.years_of_experience ?? sd.total_experience_years ?? sd.experience ?? null;
      if (typeof candidateYears === "number" && Number.isFinite(candidateYears)) return candidateYears;
      if (typeof candidateYears === "string") {
        const parsed = parseFloat(candidateYears.replace(/[^\d.]/g, ""));
        if (Number.isFinite(parsed)) return parsed;
      }
    } catch {
      /* ignore parse errors */
    }
  }

  const patterns = [
    /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b/i,
    /(\d+(?:\.\d+)?)\s*\+?\s*(?:سنوات|سنه|سنة)\b/i,
  ];
  for (const pattern of patterns) {
    const match = candText.match(pattern);
    if (match) {
      const parsed = parseFloat(match[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function computeMatch(job: Record<string, unknown>, cand: Record<string, unknown>, recruiterId: string): MatchRow {
  let candSkills: string[] = parseCandidateSkills(cand.extracted_skills);
  if (!candSkills.length && cand.structured_data) {
    try {
      const sd =
        typeof cand.structured_data === "string"
          ? JSON.parse(cand.structured_data as string)
          : (cand.structured_data as Record<string, unknown>);
      const raw = sd.skills;
      candSkills =
        typeof raw === "string"
          ? raw
              .split(/[,;\n]/)
              .map((s: string) => s.trim())
              .filter(Boolean)
          : Array.isArray(raw)
            ? (raw as string[])
            : [];
    } catch {
      /* ignore parse errors */
    }
  }

  const candTitle = (cand.current_title as string) || "";
  const candText = (cand.extracted_text as string) || "";
  const candYears = parseCandidateExperience(cand, candText);

  const t = scoreTitle(job.title as string, candTitle, candText);
  const s = scoreSkills((job.required_skills as string[]) || [], (job.preferred_skills as string[]) || [], candSkills);
  const e = scoreExperience(job.minimum_experience_years as number | null, candYears);
  const kw = scoreKeywords(job.title as string, (job.description as string) || "", candText);

  const total = Math.round(s.score * W_SKILLS + e.score * W_EXPERIENCE + t.score * W_TITLE + kw.score * W_KEYWORDS);

  return {
    candidate_id: cand.id as string,
    job_id: job.id as string,
    recruiter_id: recruiterId,
    match_score: Math.min(100, Math.max(0, total)),
    title_score: t.score,
    skills_score: s.score,
    experience_score: e.score,
    keyword_score: kw.score,
    match_reasons: [t.reason, ...s.reasons, e.reason, kw.reason].filter(Boolean),
  };
}

async function batchUpsert(db: ReturnType<typeof createClient>, rows: MatchRow[]): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map((r) => ({ ...r, updated_at: now }));
    const { error } = await db
      .from("recruiter_candidate_job_matches")
      .upsert(batch, { onConflict: "candidate_id,job_id" });
    if (error) throw new Error(`Batch upsert failed: ${error.message}`);
  }
}

async function getUnmatchedPairs(
  db: ReturnType<typeof createClient>,
  jobs: Record<string, unknown>[],
  cands: Record<string, unknown>[],
  recruiterId: string,
): Promise<Array<{ job: Record<string, unknown>; cand: Record<string, unknown> }>> {
  const threshold = new Date(Date.now() - STALE_HOURS * 3_600_000).toISOString();
  const { data: existing } = await db
    .from("recruiter_candidate_job_matches")
    .select("candidate_id, job_id, updated_at")
    .eq("recruiter_id", recruiterId);

  const fresh = new Set<string>();
  for (const m of existing || []) {
    if (m.updated_at && m.updated_at > threshold) fresh.add(`${m.candidate_id}::${m.job_id}`);
  }
  return jobs.flatMap((job) =>
    cands.filter((cand) => !fresh.has(`${cand.id}::${job.id}`)).map((cand) => ({ job, cand })),
  );
}

// ─── HTTP handler ─────────────────────────────────────────────────────────────

async function updateCandidateBestMatches(db: ReturnType<typeof createClient>, rows: MatchRow[]): Promise<void> {
  const bestByCandidate = new Map<string, MatchRow>();
  for (const row of rows) {
    const existing = bestByCandidate.get(row.candidate_id);
    if (!existing || row.match_score > existing.match_score) bestByCandidate.set(row.candidate_id, row);
  }

  for (const [candidateId, best] of bestByCandidate.entries()) {
    const { error } = await db
      .from("recruiter_candidates")
      .update({
        job_id: best.job_id,
        fit_score: best.match_score,
        fit_label:
          best.match_score >= 80 ? "High Match" : best.match_score >= 60 ? "Good Match" : best.match_score >= 40 ? "Partial Match" : "Low Match",
      })
      .eq("id", candidateId)
      .eq("recruiter_id", best.recruiter_id);
    if (error) throw new Error(`Best match update failed: ${error.message}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const t0 = Date.now();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, serviceKey);
    const recruiterId = user.id;
    const body = await req.json().catch(() => ({}));
    const {
      job_id,
      candidate_id,
      incremental = false,
    } = body as {
      job_id?: string;
      candidate_id?: string;
      incremental?: boolean;
    };

    let jobQ = db
      .from("recruiter_jobs")
      .select("id, title, description, required_skills, preferred_skills, minimum_experience_years")
      .eq("recruiter_id", recruiterId);
    if (job_id) jobQ = jobQ.eq("id", job_id);
    const { data: jobs, error: jobErr } = await jobQ;
    if (jobErr) throw jobErr;

    let candQ = db
      .from("recruiter_candidates")
      .select(
        "id, current_title, extracted_skills, extracted_experience_years, experience_years, extracted_text, structured_data",
      )
      .eq("recruiter_id", recruiterId)
      .order("created_at", { ascending: false })
      .limit(MAX_CANDS);
    if (candidate_id) candQ = candQ.eq("id", candidate_id);
    const { data: cands, error: candErr } = await candQ;
    if (candErr) throw candErr;

    if (!jobs?.length || !cands?.length) {
      return new Response(
        JSON.stringify({ matches: 0, message: "No jobs or candidates to match", duration_ms: Date.now() - t0 }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    let pairs: Array<{ job: Record<string, unknown>; cand: Record<string, unknown> }>;
    if (incremental && !job_id && !candidate_id) {
      pairs = await getUnmatchedPairs(db, jobs, cands, recruiterId);
    } else {
      pairs = jobs.flatMap((job) => cands.map((cand) => ({ job, cand })));
    }

    if (!pairs.length) {
      return new Response(
        JSON.stringify({ matches: 0, message: "All matches are already up to date", duration_ms: Date.now() - t0 }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const results = pairs.map(({ job, cand }) => computeMatch(job, cand, recruiterId));
    await batchUpsert(db, results);
    await updateCandidateBestMatches(db, results);

    const duration = Date.now() - t0;
    console.log(`[calculate-matches] ${results.length} matches in ${duration}ms`);

    return new Response(
      JSON.stringify({
        matches: results.length,
        message: `${results.length} match${results.length !== 1 ? "es" : ""} updated successfully`,
        duration_ms: duration,
        scope: job_id ? `job:${job_id}` : candidate_id ? `candidate:${candidate_id}` : "all",
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[calculate-matches] fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});


