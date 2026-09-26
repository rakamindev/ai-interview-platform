import { afterEach, describe, expect, it, vi } from "vitest";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";

vi.mock("@/stores/authAtom", () => ({ getStoredToken: () => "a-token", clearToken: vi.fn() }));

import api from "./api";
import { clearToken } from "@/stores/authAtom";

// Every request answers 401, like a wrong password or an expired session.
const answer401 = async (config: InternalAxiosRequestConfig) => {
  throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, {
    status: 401, statusText: "Unauthorized", headers: {}, config, data: {},
  });
};

describe("api client on 401", () => {
  afterEach(() => vi.mocked(clearToken).mockClear());

  it("leaves a failed login to the login page, so its error can be shown", async () => {
    api.defaults.adapter = answer401;
    await expect(api.post("/auth/login", {})).rejects.toBeInstanceOf(AxiosError);
    expect(clearToken).not.toHaveBeenCalled();
  });

  it("still signs out when a session has expired", async () => {
    api.defaults.adapter = answer401;
    await expect(api.get("/home")).rejects.toBeInstanceOf(AxiosError);
    expect(clearToken).toHaveBeenCalledOnce();
  });
});
