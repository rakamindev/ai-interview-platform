import { describe, expect, it } from "vitest";
import { parseSessionStatus } from "../sessionStatusPayload";

describe("parseSessionStatus", () => {
  it("accepts an active session with a null end reason", () => {
    expect(
      parseSessionStatus({
        type: "session_status",
        status: "active",
        end_reason: null,
      }),
    ).toEqual({
      status: "active",
      end_reason: null,
    });
  });

  it("accepts an ended session with a valid reason", () => {
    expect(
      parseSessionStatus({
        type: "session_status",
        status: "ended",
        end_reason: "all_covered",
      }),
    ).toEqual({
      status: "ended",
      end_reason: "all_covered",
    });
  });

  it("rejects an unknown session status", () => {
    expect(
      parseSessionStatus({
        type: "session_status",
        status: "unknown",
        end_reason: null,
      }),
    ).toBeNull();
  });

  it("rejects an unknown end reason", () => {
    expect(
      parseSessionStatus({
        type: "session_status",
        status: "ended",
        end_reason: "unknown_reason",
      }),
    ).toBeNull();
  });

  it("rejects a payload without an end_reason field", () => {
    expect(
      parseSessionStatus({
        type: "session_status",
        status: "active",
      }),
    ).toBeNull();
  });

  it("rejects a message of another type", () => {
    expect(
      parseSessionStatus({
        type: "coverage_update",
        status: "ended",
        end_reason: null,
      }),
    ).toBeNull();
  });

  it("rejects malformed values", () => {
    expect(parseSessionStatus(null)).toBeNull();
    expect(parseSessionStatus("session_status")).toBeNull();
  });
});
