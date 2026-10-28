/**
 * SystemCheckScreen.tsx
 *
 * Pre-interview system check UI. Consumes useSystemChecks.
 *
 * Accessibility:
 * - aria-live="polite" region announces status changes to screen readers.
 * - Each Retry button is labelled with the check name.
 * - Start Interview button is aria-disabled and visually disabled until canStart.
 */

import React from "react";
import { useSystemChecks, type CheckState, type CheckId } from "@/hooks/useSystemChecks";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw, ArrowRight } from "lucide-react";

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: CheckState["status"] }) {
  switch (status) {
    case "checking":
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />;
    case "error":
      return <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />;
    default:
      return <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 inline-block" aria-hidden="true" />;
  }
}

function statusLabel(status: CheckState["status"]): string {
  switch (status) {
    case "checking": return "Checking…";
    case "success":  return "Passed";
    case "error":    return "Failed";
    default:         return "Waiting";
  }
}

function statusColor(status: CheckState["status"]): string {
  switch (status) {
    case "success": return "text-emerald-600";
    case "error":   return "text-destructive";
    default:        return "text-muted-foreground";
  }
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface CheckRowProps {
  check: CheckState;
  onRetry: (id: CheckId) => void;
}

function CheckRow({ check, onRetry }: CheckRowProps) {
  return (
    <div className="px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        {/* Label + icon */}
        <div className="flex items-center gap-2">
          <StatusIcon status={check.status} />
          <span className="text-sm font-medium">{check.label}</span>
        </div>

        {/* Status text + optional Retry */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs ${statusColor(check.status)}`}>
            {statusLabel(check.status)}
          </span>
          {check.status === "error" && (
            <button
              type="button"
              onClick={() => onRetry(check.id)}
              aria-label={`Retry ${check.label} check`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1.5 py-0.5 transition-colors"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {check.status === "error" && check.errorMessage && (
        <p className="text-xs text-destructive pl-6">{check.errorMessage}</p>
      )}
    </div>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

interface SystemCheckScreenProps {
  onStart: () => void;
}

export default function SystemCheckScreen({ onStart }: SystemCheckScreenProps) {
  const { checks, runAll, retry, canStart } = useSystemChecks();

  const allSettled = checks.every((c) => c.status === "success" || c.status === "error");
  const hasError   = checks.some((c) => c.status === "error");

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <h2 className="text-sm font-semibold">Pre-Interview System Check</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          We&apos;ll verify your setup before you start.
        </p>
      </div>

      {/* Check rows — aria-live so screen readers announce updates */}
      <div
        role="status"
        aria-live="polite"
        aria-label="System check results"
        className="divide-y"
      >
        {checks.map((check) => (
          <CheckRow key={check.id} check={check} onRetry={retry} />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between gap-3">
        {allSettled && hasError && (
          <button
            type="button"
            onClick={runAll}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-2 py-1.5 transition-colors"
            aria-label="Retry all failed checks"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry all
          </button>
        )}

        <button
          type="button"
          onClick={canStart ? onStart : undefined}
          disabled={!canStart}
          aria-disabled={!canStart}
          className={[
            "ml-auto inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            canStart
              ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              : "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
          ].join(" ")}
        >
          Start Interview
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
