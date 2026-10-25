import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { authApi } from "@/services/auth";

// Mock the axios instance — we only assert the outgoing request shape.
vi.mock("@/services/api", () => ({
  default: { post: vi.fn(() => Promise.resolve({ data: { token: "tok" } })) },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function postMock(): Promise<Mock<(...args: unknown[]) => unknown>> {
  const api = (await import("@/services/api")).default;
  return api.post as unknown as Mock<(...args: unknown[]) => unknown>;
}

describe("authApi.login (F-03 phase 2 — tenant-implicit)", () => {
  it("posts email + password only, with no X-Tenant-Scheme header", async () => {
    const mock = await postMock();

    await authApi.login({ email: "a@b.c", password: "secret" });

    expect(mock).toHaveBeenCalledWith("/auth/login", { email: "a@b.c", password: "secret" });
  });

  it("never sends tenant headers — the scheme is derived server-side from the account", async () => {
    const mock = await postMock();

    await authApi.login({ email: "a@b.c", password: "secret" });

    const args = mock.mock.calls[0];
    expect(args[0]).toBe("/auth/login");
    expect(args[2]).toBeUndefined(); // no config → no custom headers
  });
});

describe("authApi.signup — administrator invitation redemption", () => {
  it("posts invitation token and credentials without tenant or role authority", async () => {
    const mock = await postMock();

    await authApi.signup({
      invitation_token: "invite-token",
      email: "a@b.c",
      password: "secret",
    });

    expect(mock).toHaveBeenCalledWith("/auth/signup", {
      invitation_token: "invite-token",
      email: "a@b.c",
      password: "secret",
    });
    expect(mock.mock.calls[0][1]).not.toHaveProperty("organization_id");
    expect(mock.mock.calls[0][1]).not.toHaveProperty("role");
  });
});
