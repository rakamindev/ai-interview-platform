import { toast } from "sonner";
import type { ExportResult } from "@/services/candidates";

export function toastExportFailure(): void {
  toast.error("Export failed — please try again");
}

function candidateLabel(result: ExportResult): string {
  return result.candidate_name || `candidate #${result.candidate_id}`;
}

export function toastExportSummary(results: ExportResult[]): void {
  const ok = results.filter((r) => r.status === "ok");
  const failed = results.filter((r) => r.status === "failed");
  const notFound = results.filter((r) => r.status === "not_found");

  const titleParts = [
    ok.length > 0 && `${ok.length} exported`,
    failed.length > 0 && `${failed.length} failed`,
    notFound.length > 0 && `${notFound.length} not found`,
  ].filter(Boolean);

  const title = titleParts.length > 0 ? titleParts.join(", ") : "Nothing to export";

  const descriptionLines = [
    ok.length > 0 && `Exported: ${ok.map(candidateLabel).join(", ")}`,
    failed.length > 0 &&
      `Failed: ${failed.map((r) => `${candidateLabel(r)}${r.error ? ` (${r.error})` : ""}`).join(", ")}`,
    notFound.length > 0 && `Not found: ${notFound.map(candidateLabel).join(", ")}`,
  ].filter(Boolean);

  const description = descriptionLines.length > 0 ? descriptionLines.join("\n") : undefined;

  if (ok.length > 0 && failed.length === 0 && notFound.length === 0) {
    toast.success(title, { description });
  } else if (ok.length === 0) {
    toast.error(title, { description });
  } else {
    toast.warning(title, { description });
  }
}
