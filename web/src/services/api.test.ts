import { http, HttpResponse } from "msw";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { server } from "@/test/msw-handlers";
import { api, performRefresh, startRefreshTimer, stopRefreshTimer } from "./api";
import * as authAtom from "@/stores/authAtom";

vi.hoisted(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (i: number) => [...store.keys()][i] ?? null,
    },
    configurable: true,
  });
});

const REFRESH_URL = "http://localhost:3000/api/v1/auth/refresh";
const RESOURCE_URL = "http://localhost:3000/api/v1/some-resource";

function installRefreshHandlers() {
  server.use(
    http.post(REFRESH_URL, async () => {
      return HttpResponse.json({
        data: { access_token: "new-token", user: { id: "1", email: "a@b.com", role: "candidate" } },
      });
    }),
    http.get(RESOURCE_URL, ({ request }) => {
      const auth = request.headers.get("Authorization");
      if (auth === "Bearer new-token") {
        return HttpResponse.json({ data: { ok: true } });
      }
      return new HttpResponse(null, { status: 401 });
    }),
  );
}

function installFailingRefreshHandlers() {
  server.use(
    http.post(REFRESH_URL, () => {
      return new HttpResponse(null, { status: 401 });
    }),
    http.get(RESOURCE_URL, () => {
      return new HttpResponse(null, { status: 401 });
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.restoreAllMocks();
  installRefreshHandlers();
});

afterEach(() => {
  stopRefreshTimer();
  vi.useRealTimers();
});

describe("api — 401 retry & refresh dedup", () => {
  it("two concurrent 401s trigger exactly one /refresh call", async () => {
    let refreshCount = 0;
    server.use(
      http.post(REFRESH_URL, async () => {
        refreshCount++;
        return HttpResponse.json({
          data: { access_token: "new-token", user: { id: "1", email: "a@b.com", role: "candidate" } },
        });
      }),
    );
    const [res1, res2] = await Promise.all([api.get(RESOURCE_URL), api.get(RESOURCE_URL)]);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(refreshCount).toBe(1);
  });

  it("successful refresh retries original request with new token", async () => {
    const res = await api.get(RESOURCE_URL);
    expect(res.data.ok).toBe(true);
  });

  it("failed refresh clears auth state and surfaces error", async () => {
    const clearAuthSpy = vi.spyOn(authAtom, "clearAuth");
    installFailingRefreshHandlers();
    await expect(api.get(RESOURCE_URL)).rejects.toThrow();
    expect(clearAuthSpy).toHaveBeenCalled();
  });
});

describe("api — proactive token rotation", () => {
  beforeEach(() => {
    installRefreshHandlers();
  });

  it("12-minute timer fires a refresh", async () => {
    let refreshCount = 0;
    server.use(
      http.post(REFRESH_URL, async () => {
        refreshCount++;
        return HttpResponse.json({
          data: { access_token: "new-token", user: { id: "1", email: "a@b.com", role: "candidate" } },
        });
      }),
    );
    startRefreshTimer();
    expect(refreshCount).toBe(0);
    await vi.advanceTimersByTimeAsync(12 * 60 * 1000);
    expect(refreshCount).toBe(1);
  });
});
