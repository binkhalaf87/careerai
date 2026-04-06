import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  BorderStyle,
  type ISectionOptions,
} from "docx";
import { saveAs } from "file-saver";
import {
  parseResumeTextFallback,
  type StructuredResume,
  SECTION_LABELS,
  SECTION_ORDER,
} from "@/lib/resume-utils";

const BULLET_FIELDS: Array<keyof StructuredResume> = ["experience", "skills", "certifications", "projects", "languages"];

function isArabicText(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function normalizeLine(line: string) {
  return String(line || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/^[•▪*-]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitContent(content: string) {
  return String(content || "")
    .split(/\n+/)
    .map(normalizeLine)
    .filter(Boolean);
}

function parseEnhancedResumeToStructured(content: string, fallback?: Partial<StructuredResume> | null): StructuredResume {
  const parsed = parseResumeTextFallback(content || "");
  return {
    ...parsed,
    name: parsed.name || String(fallback?.name || ""),
    job_title: parsed.job_title || String(fallback?.job_title || ""),
    contact: parsed.contact || String(fallback?.contact || ""),
    summary: parsed.summary || String(fallback?.summary || ""),
    experience: parsed.experience || String(fallback?.experience || ""),
    skills: parsed.skills || String(fallback?.skills || ""),
    education: parsed.education || String(fallback?.education || ""),
    certifications: parsed.certifications || String(fallback?.certifications || ""),
    projects: parsed.projects || String(fallback?.projects || ""),
    languages: parsed.languages || String(fallback?.languages || ""),
  };
}

function buildSectionTitle(field: keyof StructuredResume) {
  const label = SECTION_LABELS[field];
  return `${label.ar} / ${label.en}`;
}

function buildTextParagraph(text: string, opts?: { heading?: boolean; center?: boolean }) {
  const clean = normalizeLine(text);
  const rtl = isArabicText(clean);
  return new Paragraph({
    alignment: opts?.center ? AlignmentType.CENTER : rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
    bidirectional: rtl,
    spacing: { after: opts?.heading ? 140 : 110, before: opts?.heading ? 120 : 0, line: 300 },
    children: [
      new TextRun({
        text: clean,
        bold: !!opts?.heading,
        size: opts?.heading ? 24 : 22,
        rightToLeft: rtl,
      }),
    ],
  });
}

function buildBulletParagraph(text: string) {
  const clean = normalizeLine(text);
  const rtl = isArabicText(clean);
  return new Paragraph({
    bidirectional: rtl,
    alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
    bullet: { level: 0 },
    spacing: { after: 90, line: 300 },
    children: [new TextRun({ text: clean, size: 22, rightToLeft: rtl })],
  });
}

function buildHeader(structured: StructuredResume) {
  const paragraphs: Paragraph[] = [];
  if (structured.name) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: isArabicText(structured.name),
        spacing: { after: 120 },
        children: [new TextRun({ text: structured.name, bold: true, size: 32, rightToLeft: isArabicText(structured.name) })],
      }),
    );
  }

  if (structured.job_title) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: isArabicText(structured.job_title),
        spacing: { after: 120 },
        children: [new TextRun({ text: structured.job_title, italics: true, size: 24, rightToLeft: isArabicText(structured.job_title) })],
      }),
    );
  }

  if (structured.contact) {
    const contact = splitContent(structured.contact).join("  |  ");
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: isArabicText(contact),
        spacing: { after: 220 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "D4D4D8", space: 6 } },
        children: [new TextRun({ text: contact, size: 20, rightToLeft: isArabicText(contact) })],
      }),
    );
  }
  return paragraphs;
}

function buildSection(field: keyof StructuredResume, value: string) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return [] as Paragraph[];

  const paragraphs: Paragraph[] = [buildTextParagraph(buildSectionTitle(field), { heading: true })];
  const lines = splitContent(cleanValue);

  if (field === "experience") {
    let block: string[] = [];
    const flushBlock = () => {
      if (!block.length) return;
      const [header, ...rest] = block;
      paragraphs.push(buildTextParagraph(header));
      rest.forEach((line) => paragraphs.push(buildBulletParagraph(line)));
      block = [];
    };

    for (const line of lines) {
      const looksHeader = /\b(19|20)\d{2}\b/.test(line) || /[-–|]/.test(line) || /^[A-Z][A-Za-z\s/&-]{4,}$/.test(line);
      if (looksHeader && block.length) flushBlock();
      block.push(line);
    }
    flushBlock();
    return paragraphs;
  }

  if (BULLET_FIELDS.includes(field)) {
    lines.forEach((line) => paragraphs.push(buildBulletParagraph(line)));
    return paragraphs;
  }

  lines.forEach((line) => paragraphs.push(buildTextParagraph(line)));
  return paragraphs;
}

export async function downloadEnhancedResumeAsWord(args: {
  fileName?: string;
  content: string;
  fallbackStructured?: Partial<StructuredResume> | null;
}) {
  const structured = parseEnhancedResumeToStructured(args.content, args.fallbackStructured);
  const docChildren: Paragraph[] = [...buildHeader(structured)];

  if (structured.summary) docChildren.push(...buildSection("summary", structured.summary));
  for (const field of SECTION_ORDER) {
    if (field === "summary") continue;
    docChildren.push(...buildSection(field, structured[field]));
  }

  const sections: ISectionOptions[] = [
    {
      properties: {
        page: {
          margin: { top: 900, right: 900, bottom: 900, left: 900 },
        },
      },
      children: docChildren.length
        ? docChildren
        : [buildTextParagraph("السيرة الذاتية / Resume", { heading: true, center: true })],
    },
  ];

  const doc = new Document({ sections });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${args.fileName || "talentry-enhanced-resume"}.docx`);
}
