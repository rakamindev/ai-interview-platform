import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CandidateManagement from "./CandidateManagement";
import { candidatesApi } from "@/services/candidates";
import type { Candidate } from "@/types";

vi.mock("@/services/candidates", () => ({
  candidatesApi: {
    list: vi.fn(),
    export: vi.fn(),
  },
}));

const listMock = vi.mocked(candidatesApi.list);
const exportMock = vi.mocked(candidatesApi.export);

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    candidate_id: 1,
    candidate_name: "Alice Wonderland",
    session_id: 1,
    session_status: "ended",
    interview_status: "completed",
    interview_date: "2026-08-01T00:00:00Z",
    verdict: "pass",
    ...overrides,
  };
}

function mockList(candidates: Candidate[], meta = { total_count: candidates.length, total_pages: 1 }) {
  listMock.mockResolvedValue({
    data: { candidates, meta: { current_page: 1, per_page: 10, ...meta } },
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CandidateManagement", () => {
  it("renders candidates returned by the API", async () => {
    mockList([candidate()]);

    render(<CandidateManagement assessmentId={1} sessions={[]} onMonitor={vi.fn()} onResults={vi.fn()} />);

    expect(await screen.findByText("Alice Wonderland")).toBeInTheDocument();
    expect(screen.getByText("pass")).toBeInTheDocument();
  });

  it("shows the empty state when there are no candidates and no filters applied", async () => {
    mockList([], { total_count: 0, total_pages: 1 });

    render(<CandidateManagement assessmentId={1} sessions={[]} onMonitor={vi.fn()} onResults={vi.fn()} />);

    expect(await screen.findByText("No candidates yet")).toBeInTheDocument();
  });

  it("shows a filtered-empty state distinct from the no-candidates state when a search yields nothing", async () => {
    mockList([candidate()]);
    render(<CandidateManagement assessmentId={1} sessions={[]} onMonitor={vi.fn()} onResults={vi.fn()} />);
    await screen.findByText("Alice Wonderland");

    mockList([], { total_count: 0, total_pages: 1 });
    fireEvent.change(screen.getByPlaceholderText("Search candidate name..."), { target: { value: "zzz" } });

    expect(await screen.findByText("No candidates match these filters")).toBeInTheDocument();
  });

  it("passes the search term to the API after debouncing", async () => {
    mockList([candidate()]);
    render(<CandidateManagement assessmentId={1} sessions={[]} onMonitor={vi.fn()} onResults={vi.fn()} />);
    await screen.findByText("Alice Wonderland");

    fireEvent.change(screen.getByPlaceholderText("Search candidate name..."), { target: { value: "alice" } });

    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(1, expect.objectContaining({ search: "alice" }))
    );
  });

  it("shows a retry action when the fetch fails", async () => {
    listMock.mockRejectedValue(new Error("network down"));

    render(<CandidateManagement assessmentId={1} sessions={[]} onMonitor={vi.fn()} onResults={vi.fn()} />);

    expect(await screen.findByText("Couldn't load candidates")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows the bulk action bar and triggers export once candidates are selected", async () => {
    mockList([candidate()]);
    exportMock.mockResolvedValue({
      data: { exported_at: "now", format: "json", results: [] },
    } as any);
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();

    render(<CandidateManagement assessmentId={1} sessions={[]} onMonitor={vi.fn()} onResults={vi.fn()} />);
    await screen.findByText("Alice Wonderland");

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);

    expect(await screen.findByText("1 selected")).toBeInTheDocument();

    const exportTrigger = screen.getByRole("button", { name: /Export/ });
    fireEvent.pointerDown(exportTrigger, { button: 0, ctrlKey: false, pointerId: 1 });
    fireEvent.click(exportTrigger);
    fireEvent.click(await screen.findByText("Portfolio data (JSON)"));

    await waitFor(() => expect(exportMock).toHaveBeenCalledWith(1, "json", [1]));
  });

  it("clears selection when filters change", async () => {
    mockList([candidate()]);
    render(<CandidateManagement assessmentId={1} sessions={[]} onMonitor={vi.fn()} onResults={vi.fn()} />);
    await screen.findByText("Alice Wonderland");

    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    expect(await screen.findByText("1 selected")).toBeInTheDocument();

    mockList([candidate()]);
    fireEvent.change(screen.getByPlaceholderText("Search candidate name..."), { target: { value: "a" } });

    await waitFor(() => expect(screen.queryByText("1 selected")).not.toBeInTheDocument());
  });
});
