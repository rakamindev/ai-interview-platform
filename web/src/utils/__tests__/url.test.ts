import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getInterviewUrl } from "../url";

describe("getInterviewUrl - Canonical Application URL Resolution", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      origin: "http://localhost:5173",
      href: "http://localhost:5173/assessments/20/invite",
    } as any;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it("constructs frontend interview link using window.location.origin and invite_token", () => {
    const session = {
      invite_token: "tok_test_12345",
      invite_url: "http://localhost:3001/interview/tok_test_12345",
    };

    const result = getInterviewUrl(session);
    expect(result).toBe("http://localhost:5173/interview/tok_test_12345");
  });

  it("rewrites backend host/port in invite_url if invite_token is not directly provided", () => {
    const session = {
      invite_url: "http://localhost:3001/interview/fallback_token_999",
    };

    const result = getInterviewUrl(session);
    expect(result).toBe("http://localhost:5173/interview/fallback_token_999");
  });

  it("handles production origin correctly", () => {
    window.location = {
      ...originalLocation,
      origin: "https://ai-interview.rakamin.com",
    } as any;

    const session = {
      invite_token: "prod_token_abc",
      invite_url: "http://localhost:3001/interview/prod_token_abc",
    };

    const result = getInterviewUrl(session);
    expect(result).toBe("https://ai-interview.rakamin.com/interview/prod_token_abc");
  });

  it("returns empty string when session is null or empty", () => {
    expect(getInterviewUrl(null)).toBe("");
    expect(getInterviewUrl(undefined)).toBe("");
    expect(getInterviewUrl({})).toBe("");
  });
});
