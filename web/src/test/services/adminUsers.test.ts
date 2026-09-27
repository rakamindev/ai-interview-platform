import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminUsersApi } from "@/services/adminUsers";
import api from "@/services/api";

describe("Admin Users API Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls POST /admin/users with user payload", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({
      data: {
        user: {
          id: 10,
          email: "newassessor@test.com",
          role: "assessor",
          organization_id: 1,
          created_at: "2026-09-26T00:00:00Z",
        },
      },
    } as any);

    const result = await adminUsersApi.create({
      email: "newassessor@test.com",
      password: "password123",
      role: "assessor",
      organization_id: 1,
    });

    expect(postSpy).toHaveBeenCalledWith("/admin/users", {
      user: {
        email: "newassessor@test.com",
        password: "password123",
        role: "assessor",
        organization_id: 1,
      },
    });
    expect(result.data.user.email).toBe("newassessor@test.com");
  });

  it("calls GET /admin/users with query params", async () => {
    const getSpy = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        users: [
          { id: 1, email: "admin@test.com", role: "admin", created_at: "2026-09-26T00:00:00Z" },
        ],
      },
    } as any);

    const result = await adminUsersApi.list({ role: "admin" });

    expect(getSpy).toHaveBeenCalledWith("/admin/users", {
      params: { role: "admin" },
    });
    expect(result.data.users.length).toBe(1);
  });
});
