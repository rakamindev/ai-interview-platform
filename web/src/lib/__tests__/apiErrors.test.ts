import { describe, expect, it } from "vitest";
import { extractApiError, codeFromStatus } from "@/lib/apiErrors";

describe("extractApiError (F-26 unified error envelope)", () => {
  it("parses the canonical envelope { error: { code, message } }", () => {
    const result = extractApiError({
      response: { status: 404, data: { error: { code: "not_found", message: "Assessment not found" } } },
    });

    expect(result).toEqual({ status: 404, code: "not_found", message: "Assessment not found" });
  });

  it("derives the code from HTTP status when the canonical envelope omits it", () => {
    const result = extractApiError({
      response: { status: 422, data: { error: { message: "Email already taken" } } },
    });

    expect(result).toEqual({ status: 422, code: "validation_failed", message: "Email already taken" });
  });

  it("parses the legacy errors array envelope [ { status, message } ]", () => {
    const result = extractApiError({
      response: { status: 409, data: { errors: [{ status: 409, message: "Session is not ready to end" }] } },
    });

    expect(result).toEqual({ status: 409, code: "conflict", message: "Session is not ready to end" });
  });

  it("parses the legacy singular 429 shape { error: \"string\" }", () => {
    const result = extractApiError({
      response: { status: 429, data: { error: "Too many requests. Please try again later." } },
    });

    expect(result.code).toBe("rate_limited");
    expect(result.message).toContain("Too many requests");
  });

  it("normalizes a network failure (no HTTP response) to network_error", () => {
    const result = extractApiError({ message: "Network Error" });

    expect(result).toEqual({ code: "network_error", message: "Network Error" });
  });

  it("falls back to a safe default when the payload is unrecognizable", () => {
    const result = extractApiError({ response: { status: 500, data: { weird: true } } });

    expect(result).toEqual({ status: 500, code: "error", message: "Something went wrong. Please try again." });
  });

  it("maps known HTTP statuses to backend error codes", () => {
    expect(codeFromStatus(400)).toBe("bad_request");
    expect(codeFromStatus(401)).toBe("unauthorized");
    expect(codeFromStatus(403)).toBe("forbidden");
    expect(codeFromStatus(404)).toBe("not_found");
    expect(codeFromStatus(422)).toBe("validation_failed");
    expect(codeFromStatus(429)).toBe("rate_limited");
    expect(codeFromStatus(500)).toBe("error");
  });
});