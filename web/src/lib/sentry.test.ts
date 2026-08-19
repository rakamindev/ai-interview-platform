import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { initMock } = vi.hoisted(() => ({ initMock: vi.fn() }));

vi.mock("@sentry/react", () => ({ init: initMock }));

afterEach(() => {
  initMock.mockClear();
  vi.unstubAllEnvs();
});

describe("initSentry", () => {
  it("is a no-op when VITE_SENTRY_DSN is unset", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
    vi.resetModules();
    const fresh = await import("@/lib/sentry");
    fresh.initSentry();
    expect(initMock).not.toHaveBeenCalled();
  });

  it("initializes Sentry when VITE_SENTRY_DSN is set", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://fake@dsn.ingest.sentry.io/1");
    vi.resetModules();
    const fresh = await import("@/lib/sentry");
    fresh.initSentry();
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: "https://fake@dsn.ingest.sentry.io/1" }),
    );
  });
});
