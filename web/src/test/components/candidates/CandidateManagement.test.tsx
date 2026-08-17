import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CandidateManagement from "@/components/candidates/CandidateManagement";
import { candidatesApi } from "@/services/candidates";
import { toast } from "sonner";
import type { Candidate } from "@/types";
import type { ExportResult } from "@/services/candidates";

vi.mock("@/services/candidates", () => ({
  candidatesApi: {
    list: vi.fn(),
    export: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const listMock = vi.mocked(candidatesApi.list);
const exportMock = vi.mocked(candidatesApi.export);
const toastSuccessMock = vi.mocked(toast.success);
const toastErrorMock = vi.mocked(toast.error);
const toastWarningMock = vi.mocked(toast.warning);

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

function mockExport(results: ExportResult[], format = "json") {
  exportMock.mockResolvedValue({ data: { exported_at: "now", format, results } } as any);
}

async function selectFirstCandidateAndOpenExportMenu() {
  const checkboxes = screen.getAllByRole("checkbox");
  fireEvent.click(checkboxes[1]);
  await screen.findByText("1 selected");

  const exportTrigger = screen.getByRole("button", { name: /Export/ });
  fireEvent.pointerDown(exportTrigger, { button: 0, ctrlKey: false, pointerId: 1 });
  fireEvent.click(exportTrigger);
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
    mockExport([]);
    window.URL.createObjectURL = vi.fn(() => "blob:mock");
    window.URL.revokeObjectURL = vi.fn();

    render(<CandidateManagement assessmentId={1} sessions={[]} onMonitor={vi.fn()} onResults={vi.fn()} />);
    await screen.findByText("Alice Wonderland");

    await selectFirstCandidateAndOpenExportMenu();
    fireEvent.click(await screen.findByText("Portfolio data (JSON)"));

    await waitFor(() => expect(exportMock).toHaveBeenCalledWith(1, "json", [1]));
  });

  it("shows a success toast when every export result is ok", async () => {
    mockList([candidate()]);
    mockExport([{ candidate_id: 1, candidate_name: "Alice Wonderland", status: "ok", data: { turns: [] } }]);
    window.URL.createObjectURL = vi.fn(() => "blob:mock");
    window.URL.revokeObjectURL = vi.fn();

    render(<CandidateManagement assessmentId={1} sessions={[]} onMonitor={vi.fn()} onResults={vi.fn()} />);
    await screen.findByText("Alice Wonderland");

    await selectFirstCandidateAndOpenExportMenu();
    fireEvent.click(await screen.findByText("Transcript (JSON)"));

    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith("1 exported", {
        description: "Exported: Alice Wonderland",
      })
    );
    expect(toastWarningMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("shows a warning toast summarizing ok/failed/not_found counts on a mixed export", async () => {
    mockList([candidate()]);
    mockExport([
      { candidate_id: 1, candidate_name: "Alice Wonderland", status: "ok", data: {} },
      { candidate_id: 2, candidate_name: "Bob", status: "failed", error: "Portfolio not available for this candidate" },
      { candidate_id: 3, status: "not_found", error: "Candidate does not belong to this assessment" },
    ]);
    window.URL.createObjectURL = vi.fn(() => "blob:mock");
    window.URL.revokeObjectURL = vi.fn();

    render(<CandidateManagement assessmentId={1} sessions={[]} onMonitor={vi.fn()} onResults={vi.fn()} />);
    await screen.findByText("Alice Wonderland");

    await selectFirstCandidateAndOpenExportMenu();
    fireEvent.click(await screen.findByText("Portfolio data (JSON)"));

    await waitFor(() =>
      expect(toastWarningMock).toHaveBeenCalledWith("1 exported, 1 failed, 1 not found", {
        description:
          "Exported: Alice Wonderland\nFailed: Bob (Portfolio not available for this candidate)\nNot found: candidate #3",
      })
    );
  });

  it("shows an error toast when the export request itself fails", async () => {
    mockList([candidate()]);
    exportMock.mockRejectedValue(new Error("network down"));

    render(<CandidateManagement assessmentId={1} sessions={[]} onMonitor={vi.fn()} onResults={vi.fn()} />);
    await screen.findByText("Alice Wonderland");

    await selectFirstCandidateAndOpenExportMenu();
    fireEvent.click(await screen.findByText("Portfolio data (JSON)"));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Export failed — please try again"));
  });

  it("decodes and downloads only the ok results for a pdf export, skipping failed/not_found", async () => {
    mockList([candidate()]);
    mockExport(
      [
        { candidate_id: 1, candidate_name: "Alice Wonderland", status: "ok", data: { filename: "portfolio-1.pdf", pdf_base64: btoa("%PDF-fake") } },
        { candidate_id: 2, candidate_name: "Bob", status: "failed", error: "Portfolio not available for this candidate" },
      ],
      "pdf"
    );
    window.URL.createObjectURL = vi.fn(() => "blob:mock");
    window.URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<CandidateManagement assessmentId={1} sessions={[]} onMonitor={vi.fn()} onResults={vi.fn()} />);
    await screen.findByText("Alice Wonderland");

    await selectFirstCandidateAndOpenExportMenu();
    fireEvent.click(await screen.findByText("Portfolio report (PDF)"));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(toastWarningMock).toHaveBeenCalledWith("1 exported, 1 failed", {
        description: "Exported: Alice Wonderland\nFailed: Bob (Portfolio not available for this candidate)",
      })
    );

    clickSpy.mockRestore();
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
