/**
 * Deterministic fit/gap presentation helpers.
 * Kept dependency-free so critical decision-state logic can be verified with
 * Node's built-in test runner without coupling tests to the UI framework.
 */
export function summarizeFitGap(comparisons) {
  return comparisons.reduce(
    (summary, comparison) => {
      if (Object.prototype.hasOwnProperty.call(summary, comparison.result)) {
        summary[comparison.result] += 1;
      }
      if (comparison.confidence === "low") summary.lowConfidence += 1;
      if (comparison.overridden === true) summary.overrides += 1;
      return summary;
    },
    { match: 0, gap: 0, exceed: 0, not_assessed: 0, lowConfidence: 0, overrides: 0 }
  );
}

export function hasCompletedFitGapReport(payload) {
  return Boolean(payload && typeof payload === "object" && payload.report && payload.report.generation_status === "complete");
}

export function fitGapResponseState(payload) {
  if (hasCompletedFitGapReport(payload)) return "complete";
  if (!payload || typeof payload !== "object") return "invalid";
  if (payload.status === "pending" || payload.status === "generating") return "generating";
  if (payload.status === "failed") return "failed";
  return "invalid";
}

export function shouldPollFitGap(payload) {
  return fitGapResponseState(payload) === "generating";
}
