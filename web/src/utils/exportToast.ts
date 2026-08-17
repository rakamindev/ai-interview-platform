import { toast } from "sonner";
import type { ExportResult } from "@/services/candidates";

export function toastExportFailure(): void {
  toast.error("Export failed — please try again");
}

export function toastExportSummary(results: ExportResult[]): void {
  const ok = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const notFound = results.filter((r) => r.status === "not_found").length;

  const parts = [
    ok > 0 && `${ok} exported`,
    failed > 0 && `${failed} failed`,
    notFound > 0 && `${notFound} not found`,
  ].filter(Boolean);

  const message = parts.length > 0 ? parts.join(", ") : "Nothing to export";

  if (ok > 0 && failed === 0 && notFound === 0) {
    toast.success(message);
  } else if (ok === 0) {
    toast.error(message);
  } else {
    toast.warning(message);
  }
}
