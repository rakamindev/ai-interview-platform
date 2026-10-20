import { describe, it, expect, vi } from "vitest";
import { extractTextFromPdf } from "../pdfParser";
import * as pdfjsLib from "pdfjs-dist";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

describe("extractTextFromPdf - Document Text Extraction", () => {
  it("extracts and combines text across multiple pages cleanly", async () => {
    const mockPage1 = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [
          { str: "Budi Santoso" },
          { str: "Senior Software Engineer" },
          { str: "Skills: React, Ruby on Rails" },
        ],
      }),
    };

    const mockPage2 = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [
          { str: "Work Experience" },
          { str: "Tech Lead at Rakamin (2022 - Present)" },
        ],
      }),
    };

    const mockDoc = {
      numPages: 2,
      getPage: vi.fn().mockImplementation((pageNum: number) => {
        if (pageNum === 1) return Promise.resolve(mockPage1);
        if (pageNum === 2) return Promise.resolve(mockPage2);
        throw new Error("Page out of range");
      }),
    };

    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: Promise.resolve(mockDoc),
    } as any);

    const fakeBuffer = new ArrayBuffer(16);
    const result = await extractTextFromPdf(fakeBuffer);

    expect(result).toContain("Budi Santoso Senior Software Engineer Skills: React, Ruby on Rails");
    expect(result).toContain("Work Experience Tech Lead at Rakamin (2022 - Present)");
    expect(result).not.toContain("%PDF");
  });
});
