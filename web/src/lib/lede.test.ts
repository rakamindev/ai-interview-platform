import { describe, expect, it } from "vitest";
import { buildLede, ledeText } from "./lede";
import type { HomeSummary } from "@/types/home";

const summary = (overrides: Partial<HomeSummary> = {}): HomeSummary => ({
  failed_needing_reinvite: 0, stuck_reports: 0, needs_look_7d: 0, live: 0, stale_live: 0, last_result_at: null,
  ...overrides,
});

describe("buildLede", () => {
  it("says nothing needs you when nothing does, and never prints a zero", () => {
    const lede = buildLede(summary(), 0);
    expect(ledeText(lede)).toBe("Nothing needs you right now.");
    expect(lede.calm).toBe(true);
  });

  it("puts harm first, in the right singular and plural", () => {
    expect(ledeText(buildLede(summary({ failed_needing_reinvite: 1 }), 0)))
      .toBe("1 interview failed on our side and needs a re-invite.");
    expect(ledeText(buildLede(summary({ failed_needing_reinvite: 5, stuck_reports: 4 }), 0)))
      .toBe("5 interviews failed on our side and need a re-invite, and 4 reports are stuck.");
  });

  it("reads the design's busy day example, with new results since the last visit", () => {
    const busy = summary({ failed_needing_reinvite: 5, stuck_reports: 4, live: 2, new_results: 23, new_needs_look: 12 });
    expect(ledeText(buildLede(busy, 30))).toBe(
      "5 interviews failed on our side and need a re-invite, and 4 reports are stuck. " +
        "23 new results are ready, 12 of them need a human look, and 2 candidates are interviewing now."
    );
  });

  it("says 'this week', never 'new', when the page doesn't know the last visit", () => {
    expect(ledeText(buildLede(summary({ needs_look_7d: 1, live: 1 }), 4)))
      .toBe("4 results are ready this week, 1 of them needs a human look, and 1 candidate is interviewing now.");
  });

  it("links every number to its module", () => {
    const links = buildLede(summary({ failed_needing_reinvite: 2, live: 1 }), 0).sentences.flat().filter((p) => p.href);
    expect(links.map((p) => p.href)).toEqual(["#needs-you", "#live"]);
  });
});
