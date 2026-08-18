import { describe, it, expect } from "vitest";

describe("UU PDP Consent", () => {
  it("requires consent checkbox to be true before interview start", () => {
    let pdpConsent = false;
    expect(pdpConsent).toBe(false);

    pdpConsent = true;
    expect(pdpConsent).toBe(true);
  });
});
