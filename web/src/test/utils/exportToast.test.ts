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
  return { candidate_id: 1, status: "ok", ...overrides };
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
  it("fires a success toast when every result is ok", () => {
    toastExportSummary([result({ status: "ok" }), result({ status: "ok", candidate_id: 2 })]);

    expect(successMock).toHaveBeenCalledWith("2 exported");
    expect(warningMock).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("fires a warning toast summarizing ok/failed/not_found counts when mixed", () => {
    toastExportSummary([
      result({ status: "ok" }),
      result({ status: "failed", candidate_id: 2 }),
      result({ status: "not_found", candidate_id: 3 }),
    ]);

    expect(warningMock).toHaveBeenCalledWith("1 exported, 1 failed, 1 not found");
  });

  it("fires an error toast when nothing succeeded", () => {
    toastExportSummary([result({ status: "failed" }), result({ status: "not_found", candidate_id: 2 })]);

    expect(errorMock).toHaveBeenCalledWith("1 failed, 1 not found");
  });

  it("fires an error toast with a fallback message for an empty result set", () => {
    toastExportSummary([]);

    expect(errorMock).toHaveBeenCalledWith("Nothing to export");
  });
});
