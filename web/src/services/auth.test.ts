import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "@/services/api";
import { authApi } from "./auth";

vi.mock("@/services/api", () => ({
  default: { post: vi.fn() },
}));

const postMock = api.post as unknown as ReturnType<typeof vi.fn>;

describe("authApi", () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it("posts credentials to /auth/login", async () => {
    postMock.mockResolvedValue({ data: { token: "jwt-token" } });

    await authApi.login({ email: "admin@test.com", password: "password123" });

    expect(postMock).toHaveBeenCalledWith("/auth/login", {
      email: "admin@test.com",
      password: "password123",
    });
  });

  it("posts email and password to /auth/signup without a role", async () => {
    postMock.mockResolvedValue({ data: { token: "jwt-token" } });

    await authApi.signup({ email: "new@test.com", password: "password123" });

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, payload] = postMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe("/auth/signup");
    expect(payload).toEqual({ email: "new@test.com", password: "password123" });
  });
});