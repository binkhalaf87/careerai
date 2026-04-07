import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

// ── Section-specific AI guidance ────────────────────────────────
const sectionGuidance: Record<string, string> = {
  summary:
    "Refine the existing summary into 3-4 polished sentences. Improve wording and add relevant ATS keywords. Do NOT add new claims, certifications, or experience not already mentioned.",
  professionalSummary:
    "Refine the existing summary into 3-4 polished sentences. Improve wording and add relevant ATS keywords. Do NOT add new claims, certifications, or experience not already mentioned.",
  experience:
    "Rewrite existing bullets using STAR format. Start each with strong action verbs (Led, Developed, Implemented, Achieved). If the original has numbers/metrics, keep them exact. If not, do NOT invent percentages or figures — instead restructure the sentence to highlight impact. Add relevant ATS keywords naturally. IMPORTANT: Each job entry must be on its own line. Separate each role with a blank line. Bold the company name and job title using **text** markdown.",
  skills:
    "Reorganize existing skills into categories (Technical, Soft, Tools). Use industry-standard terminology for the same skills mentioned. You may add closely related ATS keywords ONLY if they are clearly implied by the existing skills. Do NOT add unrelated skills. Return each skill on its own line with a bullet (•) prefix.",
  education:
    "Format consistently with degree, institution, graduation year. Only include what is already provided. Do NOT invent GPA, honors, or coursework.",
  certifications:
    "Format in reverse chronological order. Only include what is already provided. Do NOT invent certifications, dates, or credential IDs.",
  languages:
    "List with proficiency levels. Only include languages already mentioned. Do NOT add languages the candidate did not list.",
  projects: "Improve project descriptions with impact and technologies used. Only include what is already provided.",
  bullet:
    "Improve this single resume bullet point. Make it achievement-focused using strong action verbs. Preserve all original facts. Add measurable impact phrasing if the original implies it, but do NOT invent numbers or percentages. Return ONLY the improved bullet text, no bullet character prefix.",
};

// ── Bullet micro-improvement types ──────────────────────────────
const bulletActionPrompts: Record<string, string> = {
  improve:
    "Improve this bullet point to be more impactful and achievement-focused while preserving all original facts.",
  rewrite:
    "Completely rewrite this bullet point in a more professional and impactful way while keeping the same meaning.",
  shorten: "Shorten this bullet point to be more concise while keeping the key achievement and impact.",
  achievement: "Rewrite this bullet point to focus on the achievement and result rather than just the task.",
  measurable:
    "Add measurable impact phrasing to this bullet point ONLY if the original text implies quantifiable results. Do NOT invent numbers.",
  ats: "Rewrite this bullet point with ATS-friendly keywords while preserving the original meaning and facts.",
};

function buildSystemPrompt(language: string): string {
  const langInstruction =
    language === "ar"
      ? "CRITICAL RULE #1 — OUTPUT LANGUAGE: You MUST write your ENTIRE response in Arabic (العربية). Every word must be in Arabic. Never use English. If the original text is in English, translate it to Arabic while improving it."
      : "CRITICAL RULE #1 — OUTPUT LANGUAGE: You MUST write your ENTIRE response in English. Every word must be in English. Never use Arabic. If the original text is in Arabic, translate it to English while improving it.";

  return `You are an elite resume writer and ATS optimization specialist.

${langInstruction}

ABSOLUTE RULES:
1. NEVER invent, fabricate, or add information not present in the original text.
2. NEVER add fake metrics, percentages, dollar amounts, or team sizes.
3. NEVER add certifications, degrees, companies, or job titles not in the original.
4. ONLY improve wording, sentence structure, and add relevant ATS keywords.
5. If the original text is vague, make it clearer — but do NOT add specifics that weren't there.
6. Preserve all factual details exactly as provided (names, dates, numbers, companies).
7. If content is very short, improve it gently without inventing facts.
8. The output language is FIXED by Rule #1 above — never deviate from it.`;
}

function langLine(language: string): string {
  return language === "ar"
    ? "OUTPUT LANGUAGE: Arabic only (العربية). Translate if needed."
    : "OUTPUT LANGUAGE: English only. Translate if needed.";
}

// ── Error response helper ───────────────────────────────────────
function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Normalize pipe-separated experience into line-separated ─────
function normalizeExperienceText(text: string): string {
  if (!text) return text;
  // If text contains | separators (common when experience is joined), split on them
  if (text.includes("|")) {
    return text
      .split("|")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join("\n\n");
  }
  return text;
}

function normalizeLineBreaks(value: string): string {
  return String(value || "")
    .replace(/\r/g, "")
    .trim();
}

function splitPreservingLines(value: string): string[] {
  return normalizeLineBreaks(value).split("\n");
}

function isBulletLine(line: string): boolean {
  return /^\s*[•▪*\-]\s+/.test(line);
}

function bulletPrefix(line: string): string {
  const match = line.match(/^(\s*[•▪*\-]\s+)/);
  return match ? match[1] : "";
}

function stripBulletPrefix(line: string): string {
  return line.replace(/^\s*[•▪*\-]\s+/, "").trim();
}

function normalizeWhitespace(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function isHeadingLike(line: string): boolean {
  const clean = normalizeWhitespace(stripBulletPrefix(line));
  if (!clean) return false;
  if (clean.length > 60) return false;
  return /^[A-Za-z0-9 &/()+,.:-]+$/.test(clean) && !/[.!?]$/.test(clean);
}

function structureSignature(value: string): string {
  return splitPreservingLines(value)
    .map((line) => {
      const clean = normalizeWhitespace(line);
      if (!clean) return "blank";
      if (isBulletLine(line)) return "bullet";
      if (isHeadingLike(line)) return "heading";
      return "text";
    })
    .join("|");
}

function shouldFallback(original: string, improved: string): boolean {
  const originalClean = normalizeLineBreaks(original);
  const improvedClean = normalizeLineBreaks(improved);
  if (!improvedClean) return true;
  if (originalClean.length > 40 && improvedClean.length < originalClean.length * 0.65) return true;
  // For experience sections with pipe-separated content, skip structure check
  if (originalClean.includes("|")) return false;
  if (structureSignature(originalClean) !== structureSignature(improvedClean)) return true;
  const originalLines = splitPreservingLines(originalClean).filter((l) => l.trim());
  const improvedLines = splitPreservingLines(improvedClean).filter((l) => l.trim());
  if (originalLines.length !== improvedLines.length) return true;
  return false;
}

async function callAi(apiKey: string, language: string, userPrompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildSystemPrompt(language) },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw new Error("RATE_LIMIT");
    if (status === 402) throw new Error("CREDITS_EXHAUSTED");
    const t = await response.text();
    console.error("AI error:", status, t);
    throw new Error("AI_ERROR");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ── Enhance a single section ────────────────────────────────────
async function enhanceSingleSection(
  text: string,
  sectionType: string,
  language: string,
  apiKey: string,
  options?: {
    customPrompt?: string;
    targetTitle?: string;
    targetKeywords?: string[];
  },
): Promise<string> {
  const original = normalizeLineBreaks(text);
  if (!original) return text;

  // Pre-process experience: convert pipe-separated to line-separated
  const preprocessed = sectionType === "experience" ? normalizeExperienceText(original) : original;

  const guidance =
    sectionGuidance[sectionType] || "Improve wording and add ATS keywords. Do NOT invent new information.";
  const targetTitle = options?.targetTitle?.trim();
  const targetKeywords = (options?.targetKeywords || []).filter(Boolean);
  const langInstruction = langLine(language);

  const lines = splitPreservingLines(preprocessed);
  const hasStructure = lines.filter((line) => line.trim()).length > 1;

  // Skills MUST always be processed as a whole block — never line-by-line
  // (individual skill names look like headings and get skipped incorrectly)
  const treatAsBlock = sectionType === "skills" || sectionType === "experience" || original.includes("|");

  const structuredPromptBase = options?.customPrompt?.trim()
    ? `${options.customPrompt.trim()}

REFERENCE CONTEXT:
- Section type: ${sectionType}
- Target role: ${targetTitle || "Not specified"}
- Target keywords: ${targetKeywords.join(", ") || "None provided"}
- ${langInstruction}`
    : `Improve this "${sectionType}" section of a resume.

${langInstruction}

SECTION-SPECIFIC GUIDANCE:
${guidance}

TARGET ROLE:
${targetTitle || "Not specified"}

TARGET KEYWORDS:
${targetKeywords.join(", ") || "None provided"}

STRICT RULES:
- Keep the SAME structure (same line count, same bullets, same order)
- DO NOT merge lines
- DO NOT remove lines
- DO NOT reorder content
- DO NOT change companies, job titles, dates, or facts
- Use target keywords NATURALLY inside existing lines only
- NEVER force keywords into unnatural sentences
- NEVER fabricate metrics, achievements, certifications, or experience
- ONLY improve wording inside each line`;

  if (hasStructure && !treatAsBlock) {
    const improvedLines: string[] = [];

    for (const line of lines) {
      if (!line.trim()) {
        improvedLines.push(line);
        continue;
      }

      if (isHeadingLike(line)) {
        improvedLines.push(line);
        continue;
      }

      const prefix = isBulletLine(line) ? bulletPrefix(line) : "";
      const lineBody = isBulletLine(line) ? stripBulletPrefix(line) : normalizeWhitespace(line);

      const linePrompt = `${structuredPromptBase}

${langInstruction}
IMPORTANT:
- Improve ONLY this one line
- Keep the same meaning and level of specificity
- Return ONLY the improved line text
- No bullet character prefix
- No explanations

ORIGINAL LINE:
${lineBody}`;

      try {
        const improvedLine = await callAi(apiKey, language, linePrompt);
        const safeLine = normalizeWhitespace(improvedLine) || lineBody;
        improvedLines.push(prefix ? `${prefix}${safeLine}` : safeLine);
      } catch (err) {
        improvedLines.push(line);
      }
    }

    const improvedStructured = improvedLines.join("\n").trim();
    if (shouldFallback(original, improvedStructured)) return original;
    return improvedStructured;
  }

  // Block mode: skills, experience (pipe-separated), or single-block sections
  const skillsInstructions =
    sectionType === "skills"
      ? `SKILLS-SPECIFIC RULES:
- List ALL the skills from the original — do NOT drop any
- Return each skill on its own line starting with • 
- Group related skills together if helpful
- Use ATS-friendly professional terminology
- Do NOT add skills that were not in the original`
      : "";

  const experienceInstructions =
    sectionType === "experience"
      ? `EXPERIENCE-SPECIFIC RULES:
- Each job entry must be a separate paragraph
- Separate entries with a blank line
- Keep all company names, dates, and titles exactly as-is`
      : "";

  const userPrompt = `${structuredPromptBase}

${langInstruction}
IMPORTANT:
- Return ONLY the improved text
- No explanations, headers, or markdown formatting
${skillsInstructions}
${experienceInstructions}

ORIGINAL TEXT:
${preprocessed}`;

  const improved = await callAi(apiKey, language, userPrompt);
  if (sectionType === "skills") {
    // For skills, never fallback — always return AI result if non-empty
    return improved || preprocessed || original;
  }
  if (shouldFallback(original, improved)) return preprocessed || original;
  return improved || preprocessed || original;
}

// ── Enhance a single bullet ─────────────────────────────────────
async function enhanceBullet(text: string, action: string, language: string, apiKey: string): Promise<string> {
  const actionPrompt = bulletActionPrompts[action] || bulletActionPrompts.improve;
  const langInstruction = langLine(language);

  const userPrompt = `${actionPrompt}

${langInstruction}

STRICT RULES:
- Return ONLY the improved bullet text
- No bullet character prefix (no • or -)
- No explanations, headers, or markdown
- NEVER invent facts not in the original

ORIGINAL BULLET:
${text}`;

  const result = (await callAi(apiKey, language, userPrompt)) || text;
  return result.replace(/^[•▪*\-]\s*/, "").trim();
}

// ── Main handler ────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      // Standard fields
      text,
      sectionType,
      language,
      batchSections,
      bulletText,
      bulletAction,
      sectionPrompt,
      optimizeAllPrompt,
      batchPrompts,
      targetTitle,
      targetKeywords,
      // Alternative field names sent by the ResumeEnhancement component
      section,
      content,
      jobTitle,
      extraInstruction,
    } = body;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    // ── BULLET MODE: enhance a single bullet point ──────────────
    if (bulletText && typeof bulletText === "string") {
      console.log(`Bullet enhancement requested: action=${bulletAction || "improve"}`);
      const improved = await enhanceBullet(bulletText, bulletAction || "improve", language || "en", OPENAI_API_KEY);
      return new Response(JSON.stringify({ improved_bullet: improved }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── BATCH MODE: enhance multiple sections independently ─────
    if (batchSections && typeof batchSections === "object") {
      console.log("Batch section enhancement requested:", Object.keys(batchSections));

      const results: Record<string, string> = {};
      const errors: Record<string, string> = {};

      for (const [sec, secContent] of Object.entries(batchSections as Record<string, string>)) {
        if (!secContent || !String(secContent).trim()) {
          results[sec] = "";
          continue;
        }

        try {
          console.log(`Enhancing section: ${sec} (${String(secContent).length} chars)`);
          const customPrompt =
            (batchPrompts && typeof batchPrompts === "object" && batchPrompts[sec]) ||
            optimizeAllPrompt ||
            sectionPrompt;
          const improved = await enhanceSingleSection(String(secContent), sec, language || "en", OPENAI_API_KEY, {
            customPrompt: typeof customPrompt === "string" ? customPrompt : undefined,
            targetTitle: typeof targetTitle === "string" ? targetTitle : undefined,
            targetKeywords: Array.isArray(targetKeywords) ? targetKeywords.map(String) : [],
          });
          results[sec] = improved;
          console.log(`Section ${sec} enhanced successfully`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`Section ${sec} enhancement failed:`, errMsg);

          if (errMsg === "RATE_LIMIT") {
            return errorResponse(429, "Rate limit exceeded, please try again later.");
          }
          if (errMsg === "CREDITS_EXHAUSTED") {
            return errorResponse(402, "AI credits exhausted. Please add credits.");
          }

          errors[sec] = errMsg;
          results[sec] = String(secContent);
        }
      }

      return new Response(
        JSON.stringify({ improved_sections: results, errors: Object.keys(errors).length ? errors : undefined }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── SINGLE SECTION MODE (supports both naming conventions) ──
    // Resolve text from either `text` (standard) or `content` (from ResumeEnhancement component)
    const resolvedText = text || content || "";
    const resolvedSectionType = sectionType || section || "general";
    const resolvedLanguage = language || "en";
    const resolvedTargetTitle = targetTitle || jobTitle || undefined;

    // Build custom prompt incorporating extraInstruction if provided
    const resolvedCustomPrompt = extraInstruction
      ? `${sectionPrompt || optimizeAllPrompt || ""}\n${extraInstruction}`.trim()
      : typeof sectionPrompt === "string"
        ? sectionPrompt
        : typeof optimizeAllPrompt === "string"
          ? optimizeAllPrompt
          : undefined;

    if (!String(resolvedText).trim()) {
      return errorResponse(400, "No text provided");
    }

    console.log(`Single section enhancement: type=${resolvedSectionType}, lang=${resolvedLanguage}`);

    const improved = await enhanceSingleSection(resolvedText, resolvedSectionType, resolvedLanguage, OPENAI_API_KEY, {
      customPrompt: resolvedCustomPrompt,
      targetTitle: typeof resolvedTargetTitle === "string" ? resolvedTargetTitle : undefined,
      targetKeywords: Array.isArray(targetKeywords) ? targetKeywords.map(String) : [],
    });

    // Return with multiple field names so any caller can find the result
    return new Response(
      JSON.stringify({
        improved_text: improved,
        improved: improved,
        content: improved,
        result: improved,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("improve-section error:", e);

    if (e instanceof Error) {
      if (e.message === "RATE_LIMIT") return errorResponse(429, "Rate limit exceeded, please try again later.");
      if (e.message === "CREDITS_EXHAUSTED") return errorResponse(402, "AI credits exhausted. Please add credits.");
    }

    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


