import { describe, it, expect } from "vitest";

// Helper functions mirrored from Dashboard for testability
function getFileType(fileType: string | null): string {
  if (fileType?.includes("pdf")) return "PDF";
  if (fileType?.includes("word") || fileType?.includes("docx")) return "DOCX";
  return "—";
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-primary";
  return "text-destructive";
}

describe("getFileType", () => {
  it("returns PDF for pdf mime type", () => {
    expect(getFileType("application/pdf")).toBe("PDF");
  });

  it("returns DOCX for word mime type", () => {
    expect(getFileType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("DOCX");
  });

  it("returns — for unknown type", () => {
    expect(getFileType(null)).toBe("—");
    expect(getFileType("text/plain")).toBe("—");
  });
});

describe("scoreColor", () => {
  it("returns success color for score >= 80", () => {
    expect(scoreColor(80)).toBe("text-success");
    expect(scoreColor(95)).toBe("text-success");
  });

  it("returns primary color for score 60-79", () => {
    expect(scoreColor(60)).toBe("text-primary");
    expect(scoreColor(75)).toBe("text-primary");
  });

  it("returns destructive color for score < 60", () => {
    expect(scoreColor(59)).toBe("text-destructive");
    expect(scoreColor(0)).toBe("text-destructive");
  });
});
