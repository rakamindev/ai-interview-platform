import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessmentInvitePage from "../AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";
import { extractTextFromPdf } from "@/utils/pdfParser";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));

vi.mock("@/utils/pdfParser", () => ({
  extractTextFromPdf: vi.fn().mockResolvedValue("Parsed Resume: Budi Santoso - 5 years React experience"),
}));

describe("AssessmentInvitePage - Canonical Interview Copy Link & CV Ingestion", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();

    delete (window as any).location;
    window.location = {
      ...originalLocation,
      origin: "http://localhost:5173",
      href: "http://localhost:5173/assessments/20/invite",
    } as any;

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it("copies matching frontend origin URL for existing candidate session", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValueOnce({
      data: {
        assessment: {
          id: 20,
          name: "Frontend Engineer",
          time_limit_min: 30,
          skills: [{ id: 1, name: "React", expected_level: 3 }],
        },
      },
    } as any);

    vi.mocked(assessmentsApi.getSessions).mockResolvedValueOnce({
      data: {
        sessions: [
          {
            id: 101,
            assessment_id: 20,
            candidate_name: "Jane Doe",
            invite_token: "invite_tok_jane_101",
            invite_url: "http://localhost:3001/interview/invite_tok_jane_101",
            status: "pending",
            started_at: null,
          },
        ],
      },
    } as any);

    render(
      <MemoryRouter initialEntries={["/assessments/20/invite"]}>
        <Routes>
          <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    const copyBtn = screen.getByRole("button", { name: /Copy link/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "http://localhost:5173/interview/invite_tok_jane_101"
    );
  });

  it("extracts clean parsed text when candidate uploads a PDF resume instead of raw PDF bytecode", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValueOnce({
      data: {
        assessment: {
          id: 20,
          name: "Frontend Engineer",
          time_limit_min: 30,
          skills: [{ id: 1, name: "React", expected_level: 3 }],
        },
      },
    } as any);

    vi.mocked(assessmentsApi.getSessions).mockResolvedValueOnce({
      data: { sessions: [] },
    } as any);

    render(
      <MemoryRouter initialEntries={["/assessments/20/invite"]}>
        <Routes>
          <Route path="/assessments/:id/invite" element={<AssessmentInvitePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Invite Candidate/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Invite Candidate/i }));

    const fileInput = document.getElementById("candidate-cv-file") as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const fakePdfFile = new File(["%PDF-1.7 raw bytecode"], "resume.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [fakePdfFile] } });

    await waitFor(() => {
      expect(extractTextFromPdf).toHaveBeenCalled();
      const textarea = document.getElementById("candidate-cv-text") as HTMLTextAreaElement;
      expect(textarea.value).toBe("Parsed Resume: Budi Santoso - 5 years React experience");
      expect(textarea.value).not.toContain("%PDF-1.7");
    });
  });
});
