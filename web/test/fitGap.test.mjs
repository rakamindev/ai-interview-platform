import test from "node:test";
import assert from "node:assert/strict";
import { summarizeFitGap, hasCompletedFitGapReport, fitGapResponseState, shouldPollFitGap } from "../src/lib/fitGap.js";

test("summarizes match/gap/exceed/unknown without treating unknown as a gap", () => {
  const summary = summarizeFitGap([
    { result: "match", confidence: "high" },
    { result: "gap", confidence: "low" },
    { result: "exceed", confidence: "medium", overridden: true },
    { result: "not_assessed", confidence: null },
  ]);

  assert.deepEqual(summary, { match: 1, gap: 1, exceed: 1, not_assessed: 1, lowConfidence: 1, overrides: 1 });
});

test("ignores an unknown result value instead of accidentally converting it into a gap", () => {
  const summary = summarizeFitGap([{ result: "unexpected_state", confidence: "low" }]);
  assert.equal(summary.gap, 0);
  assert.equal(summary.not_assessed, 0);
  assert.equal(summary.lowConfidence, 1);
});

test("recognizes only a completed report as complete", () => {
  assert.equal(hasCompletedFitGapReport({ report: { id: 1, generation_status: "complete" } }), true);
  assert.equal(hasCompletedFitGapReport({ report: { id: 1, generation_status: "generating" } }), false);
  assert.equal(hasCompletedFitGapReport({ status: "generating" }), false);
});

test("maps async response states without polling a failed report forever", () => {
  assert.equal(fitGapResponseState({ status: "pending" }), "generating");
  assert.equal(fitGapResponseState({ status: "generating" }), "generating");
  assert.equal(fitGapResponseState({ status: "failed", message: "model timeout" }), "failed");
  assert.equal(fitGapResponseState(null), "invalid");
  assert.equal(shouldPollFitGap({ status: "failed" }), false);
  assert.equal(shouldPollFitGap({ status: "generating" }), true);
});
