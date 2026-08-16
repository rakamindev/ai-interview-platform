import { describe, it, expect, vi, beforeEach } from "vitest";
import { portfoliosApi } from "./portfolios";

vi.mock("./api", () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

import api from "./api";

describe("portfoliosApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getFitGap calls the report endpoint and can return a report (200)", async () => {
    const report = { id: 1, portfolio_id: 1, vacancy_id: 2, overall: "match" };
    (api.get as any).mockResolvedValue({ data: { report } });

    const res = await portfoliosApi.getFitGap(1, 2);

    expect(api.get).toHaveBeenCalledWith("/portfolios/1/fitgap/2");
    expect(res.data).toEqual({ report });
  });

  it("getFitGap surfaces the generating envelope (202) — client must NOT treat it as an error", async () => {
    (api.get as any).mockResolvedValue({
      data: {
        status: "generating",
        message: "Fit/gap report generation queued",
      },
    });

    const res = await portfoliosApi.getFitGap(1, 2);

    expect(res.data).not.toHaveProperty("report");
    expect(res.data).toMatchObject({ status: "generating" });
  });

  it("getOverride posts to the skill-specific override endpoint", async () => {
    const override = {
      id: 5,
      portfolio_skill_id: 7,
      override_level: 3,
      assessor_notes: "ok",
    };
    (api.post as any).mockResolvedValue({ data: { override } });

    const res = await portfoliosApi.getOverride(7, {
      override_level: 3,
      assessor_notes: "ok",
    });

    expect(api.post).toHaveBeenCalledWith("/portfolio_skills/7/override", {
      override: { override_level: 3, assessor_notes: "ok" },
    });
    expect(res.data.override).toEqual(override);
  });
});
