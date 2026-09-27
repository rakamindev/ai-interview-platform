import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminOrganizationsApi } from "@/services/adminOrganizations";
import api from "@/services/api";

describe("Admin Organizations API Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls POST /admin/organizations with organization payload", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({
      data: {
        organization: {
          id: 5,
          name: "Tokopedia",
          scheme: "tokopedia",
          identifier: "tokopedia",
          host: "tokopedia.com",
          created_at: "2026-09-26T00:00:00Z",
        },
      },
    } as any);

    const result = await adminOrganizationsApi.create({
      name: "Tokopedia",
      scheme: "tokopedia",
      host: "tokopedia.com",
    });

    expect(postSpy).toHaveBeenCalledWith("/admin/organizations", {
      organization: {
        name: "Tokopedia",
        scheme: "tokopedia",
        host: "tokopedia.com",
      },
    });
    expect(result.data.organization.name).toBe("Tokopedia");
  });

  it("calls GET /admin/organizations", async () => {
    const getSpy = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        organizations: [
          {
            id: 1,
            name: "Test Corp",
            scheme: "test-corp",
            identifier: "test-corp",
            host: "localhost",
            created_at: "2026-09-26T00:00:00Z",
          },
        ],
      },
    } as any);

    const result = await adminOrganizationsApi.list();

    expect(getSpy).toHaveBeenCalledWith("/admin/organizations");
    expect(result.data.organizations.length).toBe(1);
    expect(result.data.organizations[0].scheme).toBe("test-corp");
  });
});
