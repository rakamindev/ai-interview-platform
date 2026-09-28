import { describe, expect, it } from "vitest";
import { getCandidateDecisionStatus, shouldRefreshCandidateSessions } from "./hiringDecision";

describe("getCandidateDecisionStatus", () => {
  it("menandai interview selesai yang report-nya belum siap sebagai Generating report", () => {
    expect(
      getCandidateDecisionStatus({ status: "ended", end_reason: "manual_candidate" }),
    ).toMatchObject({ label: "Generating report" });
  });

  it("menandai report complete tanpa keputusan sebagai Needs review", () => {
    expect(
      getCandidateDecisionStatus({
        status: "ended",
        end_reason: "manual_candidate",
        portfolio_status: "complete",
      }),
    ).toMatchObject({ label: "Needs review" });
  });

  it("menampilkan kegagalan generation secara eksplisit", () => {
    expect(
      getCandidateDecisionStatus({
        status: "ended",
        end_reason: "manual_candidate",
        portfolio_status: "failed",
      }),
    ).toMatchObject({ label: "Report failed" });
  });

  it.each([
    ["advance", "Advanced"],
    ["hold", "On hold"],
    ["reject", "Rejected"],
  ] as const)("memetakan keputusan %s ke status %s", (decision, expected) => {
    expect(
      getCandidateDecisionStatus({
        status: "ended",
        end_reason: "manual_candidate",
        portfolio_status: "complete",
        hiring_decision: decision,
      }),
    ).toMatchObject({ label: expected });
  });

  it("tidak menyamarkan interview error sebagai Needs review", () => {
    expect(
      getCandidateDecisionStatus({ status: "ended", end_reason: "error" }),
    ).toBeNull();
  });
});

describe("shouldRefreshCandidateSessions", () => {
  it("terus polling selama report masih dibuat", () => {
    expect(
      shouldRefreshCandidateSessions([
        { status: "ended", portfolio_status: "generating" },
      ]),
    ).toBe(true);
  });

  it("berhenti polling ketika report sudah siap atau gagal", () => {
    expect(
      shouldRefreshCandidateSessions([
        { status: "ended", portfolio_status: "complete" },
        { status: "ended", portfolio_status: "failed" },
      ]),
    ).toBe(false);
  });
});
