import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "./api";
import * as authAtom from "@/stores/authAtom";

describe("Axios API Interceptor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not redirect or clear token when /auth/login returns 401", async () => {
    const clearTokenSpy = vi.spyOn(authAtom, "clearToken");

    // Simulate an error on /auth/login
    const error = {
      config: { url: "/auth/login" },
      response: {
        status: 401,
        data: { errors: [{ status: 401, message: "Invalid email or password" }] },
      },
    };

    // Grab the response error handler from api interceptors
    const responseInterceptor = (api.interceptors.response as any).handlers[0];

    await expect(responseInterceptor.rejected(error)).rejects.toEqual(error);
    expect(clearTokenSpy).not.toHaveBeenCalled();
  });

  it("clears token when a protected endpoint returns 401", async () => {
    const clearTokenSpy = vi.spyOn(authAtom, "clearToken");

    const error = {
      config: { url: "/assessments" },
      response: {
        status: 401,
        data: { errors: [{ status: 401, message: "Unauthorized" }] },
      },
    };

    const responseInterceptor = (api.interceptors.response as any).handlers[0];

    await expect(responseInterceptor.rejected(error)).rejects.toEqual(error);
    expect(clearTokenSpy).toHaveBeenCalled();
  });
});
