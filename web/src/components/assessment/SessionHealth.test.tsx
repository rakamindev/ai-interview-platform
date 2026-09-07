import { sessionHealth } from "./SessionHealth";

const LIMIT = 45;
const NOW = new Date("2026-09-07T10:00:00Z");

function minutesAgo(n: number) {
  return new Date(NOW.getTime() - n * 60000).toISOString();
}

// The one question an assessor asks a list is "does any of these need me?".
// The old summary offered four readings and collapsed several very different
// situations into them.
describe("sessionHealth", () => {
  it("says nothing when the assessment has never been run", () => {
    expect(sessionHealth(undefined, LIMIT, NOW)).toBeNull();
  });

  it("waits quietly for a candidate who has not started", () => {
    expect(sessionHealth({ status: "pending" }, LIMIT, NOW)).toMatchObject({
      tone: "waiting",
      label: "Awaiting candidate",
    });
  });

  describe("a session that is running", () => {
    it("reads as live while it is within its time limit", () => {
      const health = sessionHealth({ status: "active", started_at: minutesAgo(20) }, LIMIT, NOW);

      expect(health).toMatchObject({ tone: "live", label: "Live now" });
    });

    // Before this branch a discovered skill mentioned near the end could stop a
    // session ever ending itself. Such a session sat `active` indefinitely and
    // the list happily reported "Live now" the next morning.
    it("stops calling it live once it has run far past that limit", () => {
      const health = sessionHealth({ status: "active", started_at: minutesAgo(180) }, LIMIT, NOW);

      expect(health).toMatchObject({ tone: "stale", label: "Stuck in progress" });
      expect(health!.detail).toMatch(/never ended/i);
    });

    it("allows a grace margin rather than flipping the moment the clock passes", () => {
      const health = sessionHealth({ status: "active", started_at: minutesAgo(50) }, LIMIT, NOW);

      expect(health).toMatchObject({ tone: "live" });
    });
  });

  describe("a session that has ended", () => {
    // The session did complete. The thing that failed came afterwards, which is
    // why "Last: completed" was technically true and practically useless.
    it("surfaces a portfolio that could not be generated", () => {
      const health = sessionHealth(
        { status: "ended", end_reason: "all_covered", portfolio_status: "failed" },
        LIMIT,
        NOW
      );

      expect(health).toMatchObject({ tone: "problem", label: "Portfolio failed" });
      expect(health!.detail).toMatch(/needs a retry/i);
    });

    it("shows that a rating is still being written", () => {
      expect(
        sessionHealth({ status: "ended", portfolio_status: "generating" }, LIMIT, NOW)
      ).toMatchObject({ tone: "working", label: "Generating portfolio" });
    });

    it("distinguishes a dropped connection from a clean finish", () => {
      expect(
        sessionHealth({ status: "ended", end_reason: "error", portfolio_status: "complete" }, LIMIT, NOW)
      ).toMatchObject({ tone: "problem", label: "Ended on an error" });
    });

    // Running out of time is not the same as covering the agenda, and an
    // assessor reading the resulting portfolio should know which happened.
    it("distinguishes running out of time from finishing the agenda", () => {
      expect(
        sessionHealth({ status: "ended", end_reason: "time_ceiling", portfolio_status: "complete" }, LIMIT, NOW)
      ).toMatchObject({ tone: "stale", label: "Hit the time limit" });
    });

    it("flags an ended session that produced nothing at all", () => {
      expect(
        sessionHealth({ status: "ended", end_reason: "all_covered", portfolio_status: null }, LIMIT, NOW)
      ).toMatchObject({ tone: "waiting", label: "No portfolio yet" });
    });

    it("stays quiet when there is genuinely nothing to report", () => {
      const health = sessionHealth(
        { status: "ended", end_reason: "all_covered", portfolio_status: "complete" },
        LIMIT,
        NOW
      );

      expect(health).toMatchObject({ tone: "done", label: "Completed" });
      expect(health!.detail).toBeUndefined();
    });
  });

  it("only explains itself when something needs attention", () => {
    const quiet = sessionHealth({ status: "active", started_at: minutesAgo(5) }, LIMIT, NOW);
    const loud = sessionHealth({ status: "ended", portfolio_status: "failed" }, LIMIT, NOW);

    expect(quiet!.detail).toBeUndefined();
    expect(loud!.detail).toBeDefined();
  });
});
