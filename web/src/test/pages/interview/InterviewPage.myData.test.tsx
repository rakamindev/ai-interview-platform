import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";
import type { CandidateInfo } from "@/types";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    submitConsent: vi.fn(),
    audioComplete: vi.fn(),
    getMyData: vi.fn(),
    deleteMyData: vi.fn(),
  },
}));

const getCandidateInfoMock = vi.mocked(sessionsApi.getCandidateInfo);
const getMyDataMock = vi.mocked(sessionsApi.getMyData);

function candidateInfo(overrides: Partial<CandidateInfo> = {}): CandidateInfo {
  return {
    session_id: 1,
    role_title: "Backend Engineer",
    time_limit_min: 30,
    session_status: "ended",
    consent_given: true,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/interview/abc123"]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InterviewPage complete state — your data link", () => {
  it("shows a 'View or delete your data' link on the completed screen", async () => {
    getCandidateInfoMock.mockResolvedValue({ data: candidateInfo() } as any);

    renderPage();

    expect(await screen.findByText("Interview Complete")).toBeInTheDocument();
    expect(screen.getByText("View or delete your data")).toBeInTheDocument();
  });

  it("opens the data dialog and fetches the candidate's data on click", async () => {
    getCandidateInfoMock.mockResolvedValue({ data: candidateInfo() } as any);
    getMyDataMock.mockResolvedValue({
      data: { candidate_name: "Budi", data_purged: false, transcript: [], verdict: null, skills: [] },
    } as any);

    renderPage();
    await screen.findByText("Interview Complete");

    fireEvent.click(screen.getByText("View or delete your data"));

    expect(await screen.findByText("Your data")).toBeInTheDocument();
    expect(getMyDataMock).toHaveBeenCalledWith("abc123");
  });
});
