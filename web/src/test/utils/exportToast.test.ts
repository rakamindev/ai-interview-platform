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

const DESC_OPTS = (description: string | undefined) => ({
  description,
  descriptionClassName: "whitespace-pre-line",
});

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

    expect(successMock).toHaveBeenCalledWith("2 exported", DESC_OPTS("Exported: Alice, Bob"));
    expect(warningMock).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("fires a warning toast with counts and per-candidate detail on a mixed export", () => {
    toastExportSummary([
      result({ status: "ok", candidate_id: 1, candidate_name: "Alice" }),
      result({ status: "failed", candidate_id: 2, candidate_name: "Bob", error: "Portfolio not available for this candidate" }),
      result({ status: "not_found", candidate_id: 3, candidate_name: undefined, error: "Candidate does not belong to this assessment" }),
    ]);

    expect(warningMock).toHaveBeenCalledWith(
      "1 exported, 1 failed, 1 not found",
      DESC_OPTS(
        "Exported: Alice\n" +
          "Failed (Portfolio not available for this candidate): Bob\n" +
          "Not found (Candidate does not belong to this assessment): candidate #3"
      )
    );
  });

  it("groups failed candidates sharing the same reason onto one line instead of repeating it", () => {
    toastExportSummary([
      result({ status: "failed", candidate_id: 1, candidate_name: "Santoso", error: "Portfolio not available for this candidate" }),
      result({ status: "failed", candidate_id: 2, candidate_name: "Dadan", error: "Portfolio not available for this candidate" }),
      result({ status: "failed", candidate_id: 3, candidate_name: "Budi", error: "Portfolio not available for this candidate" }),
    ]);

    expect(errorMock).toHaveBeenCalledWith(
      "3 failed",
      DESC_OPTS("Failed (Portfolio not available for this candidate): Santoso, Dadan, Budi")
    );
  });

  it("splits failed candidates into separate lines when reasons differ", () => {
    toastExportSummary([
      result({ status: "failed", candidate_id: 1, candidate_name: "Santoso", error: "Portfolio not available for this candidate" }),
      result({ status: "failed", candidate_id: 2, candidate_name: "Dadan", error: "PDF generation failed for this candidate" }),
    ]);

    expect(errorMock).toHaveBeenCalledWith(
      "2 failed",
      DESC_OPTS(
        "Failed (Portfolio not available for this candidate): Santoso\n" +
          "Failed (PDF generation failed for this candidate): Dadan"
      )
    );
  });

  it("caps a long name list and shows a '+N more' tail instead of an unreadable wall of names", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      result({ status: "ok", candidate_id: i + 1, candidate_name: `Candidate ${i + 1}` })
    );

    toastExportSummary(many);

    expect(successMock).toHaveBeenCalledWith(
      "8 exported",
      DESC_OPTS("Exported: Candidate 1, Candidate 2, Candidate 3, Candidate 4, Candidate 5, +3 more")
    );
  });

  it("falls back to a candidate-id label when not_found results carry no name", () => {
    toastExportSummary([
      result({ status: "not_found", candidate_id: 42, candidate_name: undefined, error: "Candidate does not belong to this assessment" }),
    ]);

    expect(errorMock).toHaveBeenCalledWith(
      "1 not found",
      DESC_OPTS("Not found (Candidate does not belong to this assessment): candidate #42")
    );
  });

  it("fires an error toast when nothing succeeded", () => {
    toastExportSummary([
      result({ status: "failed", candidate_id: 1, candidate_name: "Carol", error: "PDF generation failed for this candidate" }),
      result({ status: "not_found", candidate_id: 2, candidate_name: undefined, error: "Candidate does not belong to this assessment" }),
    ]);

    expect(errorMock).toHaveBeenCalledWith(
      "1 failed, 1 not found",
      DESC_OPTS(
        "Failed (PDF generation failed for this candidate): Carol\n" +
          "Not found (Candidate does not belong to this assessment): candidate #2"
      )
    );
  });

  it("fires an error toast with a fallback message for an empty result set", () => {
    toastExportSummary([]);

    expect(errorMock).toHaveBeenCalledWith("Nothing to export", DESC_OPTS(undefined));
  });
});
