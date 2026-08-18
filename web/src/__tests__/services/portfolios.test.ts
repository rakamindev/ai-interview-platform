import { describe, it, expect, vi } from "vitest";
import { portfoliosApi } from "@/services/portfolios";
import api from "@/services/api";

describe("portfoliosApi", () => {
  it("saveOverride calls POST /portfolio_skills/:id/override", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValueOnce({ data: { override: {} } });

    await portfoliosApi.saveOverride(42, { override_level: 4, assessor_notes: "Strong" });

    expect(postSpy).toHaveBeenCalledWith("/portfolio_skills/42/override", {
      override: { override_level: 4, assessor_notes: "Strong" },
    });
  });
});
