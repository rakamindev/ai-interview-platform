import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { fireEvent, screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import AssessmentListPage from "./AssessmentListPage";
import type { Assessment } from "@/types";

const { assessmentsApiMock } = vi.hoisted(() => ({
  assessmentsApiMock: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getSystemPrompt: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));

vi.mock("@/services/assessments", () => ({ assessmentsApi: assessmentsApiMock }));

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: 1,
    name: "Backend Engineer",
    role_title: "Backend Engineer",
    time_limit_min: 30,
    skills: [{ id: 1, skill_label: "SQL", expected_level: 3 }],
    ...overrides,
  } as unknown as Assessment;
}

function renderList() {
  renderWithProviders(
    <Routes>
      <Route path="/assessments" element={<AssessmentListPage />} />
      <Route path="/assessments/new" element={<div>NEW PAGE</div>} />
      <Route path="/assessments/:id/invite" element={<div>INVITE PAGE</div>} />
    </Routes>,
    { route: "/assessments" },
  );
}

describe("AssessmentListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeletons while fetching", () => {
    assessmentsApiMock.list.mockReturnValue(new Promise(() => {}));
    renderList();

    expect(document.querySelectorAll(".animate-pulse")).toHaveLength(3);
    expect(screen.getByRole("button", { name: /New Assessment/ })).toBeInTheDocument();
  });

  it("renders assessments with their time limits and session summaries", async () => {
    assessmentsApiMock.list.mockResolvedValue({
      data: {
        assessments: [
          assessment({
            id: 1,
            name: "Frontend Engineer",
            time_limit_min: 45,
            latest_session: { status: "active" },
          }),
          assessment({
            id: 2,
            name: "Data Analyst",
            latest_session: { status: "ended", end_reason: "completed" },
          }),
          assessment({
            id: 3,
            name: "DevOps Engineer",
            latest_session: { status: "ended", end_reason: "error" },
          }),
          assessment({ id: 4, name: "QA Engineer", latest_session: { status: "pending" } }),
        ],
        meta: { current_page: 1, next_page: null, prev_page: null, total_pages: 1, total_count: 4 },
      },
    });
    renderList();

    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(screen.getByText("Live now")).toBeInTheDocument();
    expect(screen.getByText("Last: completed")).toBeInTheDocument();
    expect(screen.getByText("Last: failed")).toBeInTheDocument();
    expect(screen.getByText("Awaiting candidate")).toBeInTheDocument();
  });

  it("renders the empty state with a CTA", async () => {
    assessmentsApiMock.list.mockResolvedValue({
      data: { assessments: [], meta: {} },
    });
    renderList();

    expect(await screen.findByText("No assessments yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Create your first assessment/ }));
    expect(screen.getByText("NEW PAGE")).toBeInTheDocument();
  });

  it("shows an error banner when loading fails", async () => {
    assessmentsApiMock.list.mockRejectedValue(new Error("boom"));
    renderList();

    expect(
      await screen.findByText("Failed to load assessments. Please refresh the page."),
    ).toBeInTheDocument();
  });

  it("navigates to the invite page when a card is clicked", async () => {
    assessmentsApiMock.list.mockResolvedValue({
      data: { assessments: [assessment({ id: 9, name: "Mobile Engineer" })], meta: {} },
    });
    renderList();

    fireEvent.click(await screen.findByText("Mobile Engineer"));
    expect(screen.getByText("INVITE PAGE")).toBeInTheDocument();
  });

  it("navigates to the new-assessment form", async () => {
    assessmentsApiMock.list.mockResolvedValue({
      data: { assessments: [], meta: {} },
    });
    renderList();

    fireEvent.click(screen.getByRole("button", { name: /New Assessment/ }));
    expect(screen.getByText("NEW PAGE")).toBeInTheDocument();
  });
});
