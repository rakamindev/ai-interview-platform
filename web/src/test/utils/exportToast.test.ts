import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { toastExportFailure, toastExportSummary } from "@/utils/exportToast";
import type { ExportResult } from "@/services/candidates";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const successMock = vi.mocked(toast.success);
const errorMock = vi.mocked(toast.error);
const warningMock = vi.mocked(toast.warning);

function result(overrides: Partial<ExportResult> = {}): ExportResult {
  return { candidate_id: 1, candidate_name: `Candidate ${overrides.candidate_id ?? 1}`, status: "ok", ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("toastExportFailure", () => {
  it("fires an error toast with a retry message", () => {
    toastExportFailure();

    expect(errorMock).toHaveBeenCalledWith("Export failed — please try again");
  });
});

describe("toastExportSummary", () => {
  it("fires a success toast naming every exported candidate", () => {
    toastExportSummary([
      result({ status: "ok", candidate_id: 1, candidate_name: "Alice" }),
      result({ status: "ok", candidate_id: 2, candidate_name: "Bob" }),
    ]);

    expect(successMock).toHaveBeenCalledWith("2 exported", { description: "Exported: Alice, Bob" });
    expect(warningMock).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("fires a warning toast with counts and per-candidate detail on a mixed export", () => {
    toastExportSummary([
      result({ status: "ok", candidate_id: 1, candidate_name: "Alice" }),
      result({ status: "failed", candidate_id: 2, candidate_name: "Bob", error: "Portfolio not available for this candidate" }),
      result({ status: "not_found", candidate_id: 3, candidate_name: undefined, error: "Candidate does not belong to this assessment" }),
    ]);

    expect(warningMock).toHaveBeenCalledWith("1 exported, 1 failed, 1 not found", {
      description:
        "Exported: Alice\nFailed: Bob (Portfolio not available for this candidate)\nNot found: candidate #3",
    });
  });

  it("falls back to a candidate-id label when not_found results carry no name", () => {
    toastExportSummary([result({ status: "not_found", candidate_id: 42, candidate_name: undefined })]);

    expect(errorMock).toHaveBeenCalledWith("1 not found", { description: "Not found: candidate #42" });
  });

  it("fires an error toast when nothing succeeded", () => {
    toastExportSummary([
      result({ status: "failed", candidate_id: 1, candidate_name: "Carol", error: "PDF generation failed for this candidate" }),
      result({ status: "not_found", candidate_id: 2, candidate_name: undefined }),
    ]);

    expect(errorMock).toHaveBeenCalledWith("1 failed, 1 not found", {
      description: "Failed: Carol (PDF generation failed for this candidate)\nNot found: candidate #2",
    });
  });

  it("fires an error toast with a fallback message for an empty result set", () => {
    toastExportSummary([]);

    expect(errorMock).toHaveBeenCalledWith("Nothing to export", { description: undefined });
  });
});
