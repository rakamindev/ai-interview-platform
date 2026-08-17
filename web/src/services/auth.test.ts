import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { authApi } from "./auth";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/services/api", () => ({ default: apiMock, WS_URL: "ws://test" }));

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts credentials to /auth/login", async () => {
    apiMock.post.mockResolvedValue({ data: { token: "t" } });
    const data = { email: "a@b.c", password: "secret" };
    await expect(authApi.login(data)).resolves.toEqual({ data: { token: "t" } });
    expect(apiMock.post).toHaveBeenCalledWith("/auth/login", data);
  });

  it("posts signup payload to /signup", async () => {
    apiMock.post.mockResolvedValue({ data: { token: "t" } });
    const data = { email: "a@b.c", password: "secret", role: "admin" as const };
    await authApi.signup(data);
    expect(apiMock.post).toHaveBeenCalledWith("/signup", data);
  });

  it("fetches the current user from /me", async () => {
    apiMock.get.mockResolvedValue({ data: { user: { id: 1, role: "admin" } } });
    await expect(authApi.me()).resolves.toEqual({ data: { user: { id: 1, role: "admin" } } });
    expect(apiMock.get).toHaveBeenCalledWith("/me");
  });

  it("propagates rejections", async () => {
    const error = new Error("boom");
    apiMock.post.mockRejectedValue(error);
    await expect(authApi.login({ email: "a", password: "b" })).rejects.toBe(error);
  });
});
