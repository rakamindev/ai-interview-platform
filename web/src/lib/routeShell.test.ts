import { describe, it, expect } from "vite-plus/test";
import { isAuthPath, isInterviewPath, shellForPath } from "./routeShell";

describe("routeShell", () => {
  it("isAuthPath matches only the auth routes", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/signup")).toBe(true);
    expect(isAuthPath("/access-denied")).toBe(true);
    expect(isAuthPath("/assessments")).toBe(false);
    expect(isAuthPath("/interview/abc")).toBe(false);
    expect(isAuthPath("/")).toBe(false);
  });

  it("isInterviewPath matches the interview prefix", () => {
    expect(isInterviewPath("/interview/abc")).toBe(true);
    expect(isInterviewPath("/interview")).toBe(true);
    expect(isInterviewPath("/login")).toBe(false);
    expect(isInterviewPath("/assessments")).toBe(false);
    expect(isInterviewPath("/")).toBe(false);
  });

  it("shellForPath maps each family to a variant, defaulting to assessor", () => {
    expect(shellForPath("/login")).toBe("auth");
    expect(shellForPath("/signup")).toBe("auth");
    expect(shellForPath("/access-denied")).toBe("auth");
    expect(shellForPath("/interview/xyz")).toBe("interview");
    expect(shellForPath("/assessments")).toBe("assessor");
    expect(shellForPath("/vacancies")).toBe("assessor");
    expect(shellForPath("/")).toBe("assessor");
    expect(shellForPath("/anything-else")).toBe("assessor");
  });
});
