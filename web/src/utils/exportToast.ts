import { toast } from "sonner";
import type { ExportResult } from "@/services/candidates";

export function toastExportFailure(): void {
  toast.error("Export failed — please try again");
}

const MAX_NAMES_SHOWN = 5;

function candidateLabel(result: ExportResult): string {
  return result.candidate_name || `candidate #${result.candidate_id}`;
}

function formatNames(results: ExportResult[]): string {
  const names = results.map(candidateLabel);
  if (names.length <= MAX_NAMES_SHOWN) return names.join(", ");
  const shown = names.slice(0, MAX_NAMES_SHOWN);
  return `${shown.join(", ")}, +${names.length - MAX_NAMES_SHOWN} more`;
}

// Groups by the shared error reason instead of repeating it per candidate —
// six failures with the same reason become one line, not six.
function groupedReasonLines(label: string, results: ExportResult[]): string[] {
  const groups = new Map<string, ExportResult[]>();
  results.forEach((r) => {
    const reason = r.error || "Unknown reason";
    if (!groups.has(reason)) groups.set(reason, []);
    groups.get(reason)!.push(r);
  });

  return Array.from(groups.entries()).map(
    ([reason, group]) => `${label} (${reason}): ${formatNames(group)}`
  );
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
    ok.length > 0 && `Exported: ${formatNames(ok)}`,
    ...groupedReasonLines("Failed", failed),
    ...groupedReasonLines("Not found", notFound),
  ].filter(Boolean) as string[];

  const description = descriptionLines.length > 0 ? descriptionLines.join("\n") : undefined;
  const options = { description, descriptionClassName: "whitespace-pre-line" };

  if (ok.length > 0 && failed.length === 0 && notFound.length === 0) {
    toast.success(title, options);
  } else if (ok.length === 0) {
    toast.error(title, options);
  } else {
    toast.warning(title, options);
  }
}
