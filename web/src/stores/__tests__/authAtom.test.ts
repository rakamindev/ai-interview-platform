import { beforeEach, describe, expect, it } from "vitest";
import { clearToken, getStoredToken, saveToken } from "@/stores/authAtom";
import { queryClient } from "@/lib/queryClient";

describe("auth query cache isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
  });

  it("clears cached server data when a new identity signs in", () => {
    queryClient.setQueryData(["assessments"], { private: true });

    saveToken("new-token");

    expect(getStoredToken()).toBe("new-token");
    expect(queryClient.getQueryData(["assessments"])).toBeUndefined();
  });

  it("clears cached server data on logout", () => {
    localStorage.setItem("auth_token", "old-token");
    queryClient.setQueryData(["sessions"], { private: true });

    clearToken();

    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(queryClient.getQueryData(["sessions"])).toBeUndefined();
  });
});
