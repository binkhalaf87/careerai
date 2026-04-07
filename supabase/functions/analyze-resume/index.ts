import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const toolSchema = {
  type: "function",
  function: {
    name: "submit_analysis",
    description: "Submit the complete ATS career intelligence analysis report.",
    parameters: {
      type: "object",
      properties: {
        target_role: { type: "string", description: "The target role chosen or inferred for the candidate" },
        candidate_name: { type: "string" },
        ats_score: { type: "number" },
        section_scores: {
          type: "object",
          properties: {
            resume_formatting: { type: "number" },
            keyword_optimization: { type: "number" },
            experience_quality: { type: "number" },
            career_progression: { type: "number" },
            skills_relevance: { type: "number" },
            education_strength: { type: "number" },
            contact_information_quality: { type: "number" },
          },
          required: [
            "resume_formatting",
            "keyword_optimization",
            "experience_quality",
            "career_progression",
            "skills_relevance",
            "education_strength",
            "contact_information_quality",
          ],
          additionalProperties: false,
        },
        executive_summary: {
          type: "object",
          properties: {
            candidate_level: { type: "string", enum: ["junior", "mid", "senior", "executive"] },
            summary_paragraphs: { type: "string" },
            best_fit_roles: { type: "array", items: { type: "string" } },
            top_strengths: { type: "array", items: { type: "string" } },
            main_risks: { type: "array", items: { type: "string" } },
          },
          required: ["candidate_level", "summary_paragraphs", "best_fit_roles", "top_strengths", "main_risks"],
          additionalProperties: false,
        },
        ats_breakdown: {
          type: "object",
          properties: {
            formatting: {
              type: "object",
              properties: {
                score: { type: "number" },
                current_state: { type: "string" },
                problem: { type: "string" },
                recommended_improvement: { type: "string" },
              },
              required: ["score", "current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
            sections: {
              type: "object",
              properties: {
                score: { type: "number" },
                current_state: { type: "string" },
                problem: { type: "string" },
                recommended_improvement: { type: "string" },
              },
              required: ["score", "current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
            keywords: {
              type: "object",
              properties: {
                score: { type: "number" },
                current_state: { type: "string" },
                problem: { type: "string" },
                recommended_improvement: { type: "string" },
              },
              required: ["score", "current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
            experience: {
              type: "object",
              properties: {
                score: { type: "number" },
                current_state: { type: "string" },
                problem: { type: "string" },
                recommended_improvement: { type: "string" },
              },
              required: ["score", "current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
            education: {
              type: "object",
              properties: {
                score: { type: "number" },
                current_state: { type: "string" },
                problem: { type: "string" },
                recommended_improvement: { type: "string" },
              },
              required: ["score", "current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
            skills: {
              type: "object",
              properties: {
                score: { type: "number" },
                current_state: { type: "string" },
                problem: { type: "string" },
                recommended_improvement: { type: "string" },
              },
              required: ["score", "current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
            contact_info: {
              type: "object",
              properties: {
                score: { type: "number" },
                current_state: { type: "string" },
                problem: { type: "string" },
                recommended_improvement: { type: "string" },
              },
              required: ["score", "current_state", "problem", "recommended_improvement"],
              additionalProperties: false,
            },
          },
          required: ["formatting", "sections", "keywords", "experience", "education", "skills", "contact_info"],
          additionalProperties: false,
        },
        recruiter_analysis: {
          type: "object",
          properties: {
            first_impression: {
              type: "object",
              properties: { score: { type: "number" }, comment: { type: "string" } },
              required: ["score", "comment"],
              additionalProperties: false,
            },
            career_clarity: {
              type: "object",
              properties: { score: { type: "number" }, comment: { type: "string" } },
              required: ["score", "comment"],
              additionalProperties: false,
            },
            achievement_strength: {
              type: "object",
              properties: { score: { type: "number" }, comment: { type: "string" } },
              required: ["score", "comment"],
              additionalProperties: false,
            },
            role_alignment: {
              type: "object",
              properties: { score: { type: "number" }, comment: { type: "string" } },
              required: ["score", "comment"],
              additionalProperties: false,
            },
            professional_presentation: {
              type: "object",
              properties: { score: { type: "number" }, comment: { type: "string" } },
              required: ["score", "comment"],
              additionalProperties: false,
            },
          },
          required: [
            "first_impression",
            "career_clarity",
            "achievement_strength",
            "role_alignment",
            "professional_presentation",
          ],
          additionalProperties: false,
        },
        career_recommendations: {
          type: "object",
          properties: {
            top_roles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  why_it_fits: { type: "string" },
                },
                required: ["role", "why_it_fits"],
                additionalProperties: false,
              },
            },
            skills_to_improve: { type: "array", items: { type: "string" } },
            thirty_sixty_ninety_day_plan: {
              type: "object",
              properties: {
                thirty_days: { type: "string" },
                sixty_days: { type: "string" },
                ninety_days: { type: "string" },
              },
              required: ["thirty_days", "sixty_days", "ninety_days"],
              additionalProperties: false,
            },
            certifications_recommended: { type: "array", items: { type: "string" } },
            linkedin_improvements: { type: "string" },
          },
          required: ["top_roles", "skills_to_improve", "thirty_sixty_ninety_day_plan", "certifications_recommended"],
          additionalProperties: false,
        },
        salary_estimation: {
          type: "object",
          properties: {
            salary_table: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  monthly_range_low: { type: "number" },
                  monthly_range_high: { type: "number" },
                  when_upper_range: { type: "string" },
                  notes: { type: "string" },
                },
                required: ["role", "monthly_range_low", "monthly_range_high", "when_upper_range", "notes"],
                additionalProperties: false,
              },
            },
            offer_range_low: { type: "number" },
            offer_range_high: { type: "number" },
            negotiation_target: { type: "number" },
            anchor: { type: "number" },
            walk_away: { type: "number" },
          },
          required: [
            "salary_table",
            "offer_range_low",
            "offer_range_high",
            "negotiation_target",
            "anchor",
            "walk_away",
          ],
          additionalProperties: false,
        },
        resume_rewrite: {
          type: "object",
          properties: {
            full_resume: { type: "string" },
          },
          required: ["full_resume"],
          additionalProperties: false,
        },
        quick_improvements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              priority: { type: "string", enum: ["high", "medium", "low"] },
              description: { type: "string" },
              action_step: { type: "string" },
            },
            required: ["priority", "description", "action_step"],
            additionalProperties: false,
          },
        },
        interview_questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              suggested_answer_direction: { type: "string" },
            },
            required: ["question", "suggested_answer_direction"],
            additionalProperties: false,
          },
        },
      },
      required: [
        "target_role",
        "candidate_name",
        "ats_score",
        "section_scores",
        "executive_summary",
        "ats_breakdown",
        "recruiter_analysis",
        "career_recommendations",
        "salary_estimation",
        "resume_rewrite",
        "quick_improvements",
        "interview_questions",
      ],
      additionalProperties: false,
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clampScore(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asString(value: unknown, fallback = "") {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function normalizeAnalysis(raw: any, language: string) {
  const fallbackText = language === "ar" ? "[يرجى التأكيد]" : "[Please confirm]";

  return {
    target_role: asString(raw?.target_role, fallbackText),
    candidate_name: asString(raw?.candidate_name, fallbackText),
    ats_score: clampScore(raw?.ats_score, 0),
    section_scores: {
      resume_formatting: clampScore(raw?.section_scores?.resume_formatting, 0),
      keyword_optimization: clampScore(raw?.section_scores?.keyword_optimization, 0),
      experience_quality: clampScore(raw?.section_scores?.experience_quality, 0),
      career_progression: clampScore(raw?.section_scores?.career_progression, 0),
      skills_relevance: clampScore(raw?.section_scores?.skills_relevance, 0),
      education_strength: clampScore(raw?.section_scores?.education_strength, 0),
      contact_information_quality: clampScore(raw?.section_scores?.contact_information_quality, 0),
    },
    executive_summary: {
      candidate_level: ["junior", "mid", "senior", "executive"].includes(raw?.executive_summary?.candidate_level)
        ? raw.executive_summary.candidate_level
        : "mid",
      summary_paragraphs: asString(raw?.executive_summary?.summary_paragraphs, fallbackText),
      best_fit_roles: asStringArray(raw?.executive_summary?.best_fit_roles),
      top_strengths: asStringArray(raw?.executive_summary?.top_strengths),
      main_risks: asStringArray(raw?.executive_summary?.main_risks),
    },
    ats_breakdown: {
      formatting: {
        score: clampScore(raw?.ats_breakdown?.formatting?.score, 0),
        current_state: asString(raw?.ats_breakdown?.formatting?.current_state, fallbackText),
        problem: asString(raw?.ats_breakdown?.formatting?.problem, fallbackText),
        recommended_improvement: asString(raw?.ats_breakdown?.formatting?.recommended_improvement, fallbackText),
      },
      sections: {
        score: clampScore(raw?.ats_breakdown?.sections?.score, 0),
        current_state: asString(raw?.ats_breakdown?.sections?.current_state, fallbackText),
        problem: asString(raw?.ats_breakdown?.sections?.problem, fallbackText),
        recommended_improvement: asString(raw?.ats_breakdown?.sections?.recommended_improvement, fallbackText),
      },
      keywords: {
        score: clampScore(raw?.ats_breakdown?.keywords?.score, 0),
        current_state: asString(raw?.ats_breakdown?.keywords?.current_state, fallbackText),
        problem: asString(raw?.ats_breakdown?.keywords?.problem, fallbackText),
        recommended_improvement: asString(raw?.ats_breakdown?.keywords?.recommended_improvement, fallbackText),
      },
      experience: {
        score: clampScore(raw?.ats_breakdown?.experience?.score, 0),
        current_state: asString(raw?.ats_breakdown?.experience?.current_state, fallbackText),
        problem: asString(raw?.ats_breakdown?.experience?.problem, fallbackText),
        recommended_improvement: asString(raw?.ats_breakdown?.experience?.recommended_improvement, fallbackText),
      },
      education: {
        score: clampScore(raw?.ats_breakdown?.education?.score, 0),
        current_state: asString(raw?.ats_breakdown?.education?.current_state, fallbackText),
        problem: asString(raw?.ats_breakdown?.education?.problem, fallbackText),
        recommended_improvement: asString(raw?.ats_breakdown?.education?.recommended_improvement, fallbackText),
      },
      skills: {
        score: clampScore(raw?.ats_breakdown?.skills?.score, 0),
        current_state: asString(raw?.ats_breakdown?.skills?.current_state, fallbackText),
        problem: asString(raw?.ats_breakdown?.skills?.problem, fallbackText),
        recommended_improvement: asString(raw?.ats_breakdown?.skills?.recommended_improvement, fallbackText),
      },
      contact_info: {
        score: clampScore(raw?.ats_breakdown?.contact_info?.score, 0),
        current_state: asString(raw?.ats_breakdown?.contact_info?.current_state, fallbackText),
        problem: asString(raw?.ats_breakdown?.contact_info?.problem, fallbackText),
        recommended_improvement: asString(raw?.ats_breakdown?.contact_info?.recommended_improvement, fallbackText),
      },
    },
    recruiter_analysis: {
      first_impression: {
        score: clampScore(raw?.recruiter_analysis?.first_impression?.score, 0),
        comment: asString(raw?.recruiter_analysis?.first_impression?.comment, fallbackText),
      },
      career_clarity: {
        score: clampScore(raw?.recruiter_analysis?.career_clarity?.score, 0),
        comment: asString(raw?.recruiter_analysis?.career_clarity?.comment, fallbackText),
      },
      achievement_strength: {
        score: clampScore(raw?.recruiter_analysis?.achievement_strength?.score, 0),
        comment: asString(raw?.recruiter_analysis?.achievement_strength?.comment, fallbackText),
      },
      role_alignment: {
        score: clampScore(raw?.recruiter_analysis?.role_alignment?.score, 0),
        comment: asString(raw?.recruiter_analysis?.role_alignment?.comment, fallbackText),
      },
      professional_presentation: {
        score: clampScore(raw?.recruiter_analysis?.professional_presentation?.score, 0),
        comment: asString(raw?.recruiter_analysis?.professional_presentation?.comment, fallbackText),
      },
    },
    career_recommendations: {
      top_roles: Array.isArray(raw?.career_recommendations?.top_roles)
        ? raw.career_recommendations.top_roles
            .map((item: any) => ({
              role: asString(item?.role),
              why_it_fits: asString(item?.why_it_fits),
            }))
            .filter((item: any) => item.role || item.why_it_fits)
        : [],
      skills_to_improve: asStringArray(raw?.career_recommendations?.skills_to_improve),
      thirty_sixty_ninety_day_plan: {
        thirty_days: asString(raw?.career_recommendations?.thirty_sixty_ninety_day_plan?.thirty_days, fallbackText),
        sixty_days: asString(raw?.career_recommendations?.thirty_sixty_ninety_day_plan?.sixty_days, fallbackText),
        ninety_days: asString(raw?.career_recommendations?.thirty_sixty_ninety_day_plan?.ninety_days, fallbackText),
      },
      certifications_recommended: asStringArray(raw?.career_recommendations?.certifications_recommended),
      linkedin_improvements: asString(raw?.career_recommendations?.linkedin_improvements, ""),
    },
    salary_estimation: {
      salary_table: Array.isArray(raw?.salary_estimation?.salary_table)
        ? raw.salary_estimation.salary_table
            .map((item: any) => ({
              role: asString(item?.role),
              monthly_range_low: Number(item?.monthly_range_low) || 0,
              monthly_range_high: Number(item?.monthly_range_high) || 0,
              when_upper_range: asString(item?.when_upper_range),
              notes: asString(item?.notes),
            }))
            .filter((item: any) => item.role)
        : [],
      offer_range_low: Number(raw?.salary_estimation?.offer_range_low) || 0,
      offer_range_high: Number(raw?.salary_estimation?.offer_range_high) || 0,
      negotiation_target: Number(raw?.salary_estimation?.negotiation_target) || 0,
      anchor: Number(raw?.salary_estimation?.anchor) || 0,
      walk_away: Number(raw?.salary_estimation?.walk_away) || 0,
    },
    resume_rewrite: {
      full_resume: asString(raw?.resume_rewrite?.full_resume, fallbackText),
    },
    quick_improvements: Array.isArray(raw?.quick_improvements)
      ? raw.quick_improvements
          .map((item: any) => ({
            priority: ["high", "medium", "low"].includes(item?.priority) ? item.priority : "medium",
            description: asString(item?.description),
            action_step: asString(item?.action_step),
          }))
          .filter((item: any) => item.description || item.action_step)
      : [],
    strengths: asStringArray(raw?.strengths || raw?.executive_summary?.top_strengths).slice(0, 6),
    weaknesses: asStringArray(raw?.weaknesses || raw?.executive_summary?.main_risks).slice(0, 6),
    missing_keywords: asStringArray(raw?.missing_keywords || raw?.career_recommendations?.skills_to_improve).slice(0, 12),
    improvements: Array.isArray(raw?.improvements)
      ? raw.improvements
          .map((item: any) => ({
            title: asString(item?.title || item?.description),
            action: asString(item?.action || item?.action_step || item?.description),
            priority: ["high", "medium", "low"].includes(item?.priority) ? item.priority : "medium",
          }))
          .filter((item: any) => item.title || item.action)
      : [],
    interview_questions: Array.isArray(raw?.interview_questions)
      ? raw.interview_questions
          .map((item: any) => ({
            question: asString(item?.question),
            suggested_answer_direction: asString(item?.suggested_answer_direction),
          }))
          .filter((item: any) => item.question || item.suggested_answer_direction)
      : [],
  };
}

function getMessageContentAsText(content: unknown) {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return asString((part as any).text);
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function tryExtractJsonFromText(content: string) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const candidate = content.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function buildPrompt(resumeText: string, language: string) {
  const langInstruction =
    language === "ar"
      ? "أجب باللغة العربية الفصحى الواضحة لجميع الأقسام باستثناء resume_rewrite الذي يجب أن يكون بالإنجليزية المهنية حصراً."
      : "Respond in English for all sections. The resume_rewrite must always be in professional English only.";

  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `You are a Senior Recruitment Director and Certified ATS Specialist with 20+ years of experience across the Saudi Arabian, Gulf (GCC), and global job markets. You have deep expertise in:
- Saudi Vision 2030 sector priorities (NEOM, tourism, tech, healthcare, finance)
- Gulf employment norms: GOSI, Iqama, Nitaqat, nationalization (Saudization/Emiratization)
- ATS systems used by top regional employers (SAP SuccessFactors, Oracle HCM, Taleo, Workday)
- Competitive salary benchmarks in SAR for the Saudi/GCC market

${langInstruction}

TODAY'S DATE: ${today}. Use this as the reference for all date calculations.

ABSOLUTE RULES:
1. NEVER invent or fabricate candidate information. If data is missing, write "[يرجى التأكيد]" (AR) or "[Please confirm]" (EN).
2. ALL scores must be integers between 0-100. Be precise, not generous — a score of 70+ means genuinely competitive.
3. ALL salary figures in SAR (monthly), calibrated for the Saudi/GCC market specifically.
4. Be brutally honest, specific, and actionable — generic advice is useless.
5. The resume_rewrite.full_resume MUST be in English only, using strong action verbs, STAR format, quantified achievements, and industry-standard ATS keywords.
6. For interview_questions, provide exactly 10 questions tailored to the target role and Saudi/GCC hiring context.
7. For quick_improvements, provide exactly 12 items in imperative form ("Add X", "Remove Y", "Replace Z with W").
8. When calculating years of experience, always use ${today} as the end date.
9. Factor in Saudi-specific elements: whether they mention Iqama/work authorization, language skills (Arabic/English proficiency), Saudi/GCC industry certifications.
10. ATS score must reflect real-world ATS system performance — be strict.`;

  const userPrompt = `Perform a comprehensive ATS Career Intelligence Analysis for the Saudi/GCC job market on the following resume.

If no target role is specified, infer the BEST target role based on the candidate's strongest skills and most recent experience — optimized for the Saudi/GCC market.

═══════════════════ RESUME TEXT ═══════════════════
${resumeText}
═══════════════════════════════════════════════════

Analyze and return ALL sections via tool call:

① TARGET ROLE
   - Infer the most competitive role for this candidate in the Saudi/GCC market.
   - Consider Vision 2030 alignment if applicable.

② EXECUTIVE SUMMARY
   - candidate_level: Must be one of ["junior","mid","senior","executive"]
   - summary_paragraphs: 2-3 paragraphs covering: overall impression, key value proposition, critical gaps. Be honest.
   - best_fit_roles: 3-5 specific role titles (e.g., "Senior Financial Analyst", not just "Finance")
   - top_strengths: 3 concrete, specific strengths with evidence from the resume
   - main_risks: 3 real hiring risks that would make a Saudi/GCC recruiter hesitate

③ ATS SCORE (0-100) + SECTION SCORES
   Score each dimension honestly:
   - resume_formatting: Layout, length (1-2 pages ideal), font readability, consistent structure
   - keyword_optimization: Presence of role-specific keywords, industry terms, certifications mentioned
   - experience_quality: Quantified achievements, STAR format, impact shown (not just duties listed)
   - career_progression: Upward trajectory, logical flow, no unexplained gaps > 6 months
   - skills_relevance: Hard skills match to target role, tech stack, certifications
   - education_strength: Degree relevance, institution prestige, graduation year, continuing education
   - contact_information_quality: Name, phone, email, LinkedIn, location, Nationality/Iqama status (if relevant)

④ ATS BREAKDOWN (7 categories: formatting, sections, keywords, experience, education, skills, contact_info)
   For each: score (0-100) + current_state + problem + recommended_improvement

⑤ RECRUITER ANALYSIS (Saudi/GCC recruiter perspective)
   Score 0-100 + practical comment for each:
   - first_impression: What a recruiter thinks in the first 6 seconds
   - career_clarity: Is the career direction obvious and consistent?
   - achievement_strength: Do achievements stand out vs. just listing duties?
   - role_alignment: Does this resume feel tailored or generic?
   - professional_presentation: Grammar, formatting, professionalism level

⑥ CAREER RECOMMENDATIONS (Saudi/GCC market focus)
   - top_roles: 3-5 roles with specific why_it_fits reasoning
   - skills_to_improve: 5-8 specific skills/technologies, not generic ("Learn Python" not "improve tech skills")
   - thirty_sixty_ninety_day_plan: Concrete, actionable milestones for job search
   - certifications_recommended: 3-5 specific certs with names (e.g., "PMP", "CFA Level 1", "AWS SAA", "CIPA")
   - linkedin_improvements: 3-5 specific LinkedIn profile improvements

⑦ SALARY ESTIMATION (SAR monthly, Saudi market)
   - salary_table: Target role + 2-3 related roles. Include: role, monthly_range_low, monthly_range_high, when_upper_range, notes (sector/city adjustments)
   - offer_range_low, offer_range_high: Realistic range for THIS candidate
   - negotiation_target: What to ask for
   - anchor: Opening ask number
   - walk_away: Minimum acceptable

⑧ RESUME REWRITE (English ONLY — full ATS-optimized version)
   Rewrite with: Strong header, Professional Summary (3-4 lines), Key Skills (technical + soft), Work Experience (STAR + numbers), Education, Certifications, Languages.
   Do NOT invent any information. Use "[Please confirm]" for unknowns.

⑨ QUICK IMPROVEMENTS (exactly 12 items, ordered high→medium→low priority)
   Each must be: specific, imperative, and immediately actionable.
   Examples: "Add LinkedIn URL to header", "Replace 'Responsible for' with 'Managed/Led/Optimized'", "Quantify the 2022 project outcome with % or SAR figure"

⑩ INTERVIEW QUESTIONS (exactly 10 questions for the target role in Saudi/GCC context)
   Mix behavioral, technical, and situational questions.
   Each suggested_answer_direction must be 4-6 lines with specific guidance.`;

  return { systemPrompt, userPrompt };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const resumeText = asString(payload?.resumeText);
    const language = payload?.language === "ar" ? "ar" : "en";

    if (!resumeText || resumeText.length < 30) {
      return jsonResponse({ error: "Resume text is missing or too short" }, 400);
    }

    const { systemPrompt, userPrompt } = buildPrompt(resumeText, language);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 170000);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "submit_analysis" } },
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const responseText = await response.text();

      if (response.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded, please try again later." }, 429);
      }

      if (response.status === 402) {
        return jsonResponse({ error: "AI credits exhausted. Please add credits." }, 402);
      }

      console.error("AI gateway error:", response.status, responseText);
      return jsonResponse({ error: "AI gateway error" }, 502);
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.[0];

    let parsedAnalysis: any = null;

    if (toolCall?.function?.arguments) {
      try {
        parsedAnalysis = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        console.error("Tool call JSON parse error:", parseError);
      }
    }

    if (!parsedAnalysis) {
      const contentText = getMessageContentAsText(message?.content);
      if (contentText) {
        parsedAnalysis = tryExtractJsonFromText(contentText);
      }
    }

    if (!parsedAnalysis) {
      console.error("Invalid AI response payload:", JSON.stringify(data));
      return jsonResponse({ error: "AI returned an invalid response format" }, 502);
    }

    const analysis = normalizeAnalysis(parsedAnalysis, language);

    if (!analysis.strengths.length) {
      analysis.strengths = analysis.executive_summary.top_strengths.slice(0, 6);
    }
    if (!analysis.weaknesses.length) {
      analysis.weaknesses = analysis.executive_summary.main_risks.slice(0, 6);
    }
    if (!analysis.missing_keywords.length) {
      analysis.missing_keywords = analysis.career_recommendations.skills_to_improve.slice(0, 12);
    }
    if (!analysis.improvements.length) {
      analysis.improvements = analysis.quick_improvements.slice(0, 8).map((item: any) => ({
        title: item.description,
        action: item.action_step,
        priority: item.priority,
      }));
    }

    return jsonResponse(analysis, 200);
  } catch (error) {
    const err = error as Error;
    console.error("analyze-resume error:", err);

    if (err?.name === "AbortError") {
      return jsonResponse({ error: "AI analysis timed out" }, 504);
    }

    return jsonResponse({ error: err?.message || "Unknown error" }, 500);
  }
});
