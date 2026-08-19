import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import api from "./api";

const { createMock, requestHandlers, responseHandlers } = vi.hoisted(() => {
  const requestHandlers: ((config: Record<string, unknown>) => Record<string, unknown>)[] = [];
  const responseHandlers: {
    onFulfilled: (response: { data: unknown }) => { data: unknown };
    onRejected: (error: unknown) => Promise<never>;
  }[] = [];
  const createMock = vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    defaults: {},
    interceptors: {
      request: {
        use: (fn: (config: Record<string, unknown>) => Record<string, unknown>) =>
          requestHandlers.push(fn),
      },
      response: {
        use: (
          onFulfilled: (response: { data: unknown }) => { data: unknown },
          onRejected: (error: unknown) => Promise<never>,
        ) => responseHandlers.push({ onFulfilled, onRejected }),
      },
    },
  }));
  return { createMock, requestHandlers, responseHandlers };
});

vi.mock("axios", () => ({ default: { create: createMock }, create: createMock }));

describe("api client", () => {
  const requestHandler = () => requestHandlers[0];
  const responseHandler = () => responseHandlers[0];

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to localhost defaults when env vars are absent", async () => {
    vi.stubEnv("VITE_WS_BASE_URL", undefined);
    vi.resetModules();

    const { WS_URL: wsUrl } = await import("./api");
    expect(wsUrl).toBe("ws://localhost:3000");

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("attaches the stored token as a Bearer header", () => {
    localStorage.setItem("auth_token", "tok123");
    const config = { headers: {} as Record<string, string> };
    requestHandler()(config);
    expect(config.headers.Authorization).toBe("Bearer tok123");
  });

  it("leaves the headers untouched when no token is stored", () => {
    const config = { headers: {} as Record<string, string> };
    requestHandler()(config);
    expect(config.headers.Authorization).toBeUndefined();
  });

  it("unwraps the { data: ... } envelope from successful responses", () => {
    const onFulfilled = responseHandler().onFulfilled;
    expect(onFulfilled({ data: { data: { assessment: { id: 1 } } } }).data).toEqual({
      assessment: { id: 1 },
    });
    expect(onFulfilled({ data: { plain: true } }).data).toEqual({ plain: true });
  });

  it("clears the token and dispatches session-expired on 401 for non-auth requests", async () => {
    localStorage.setItem("auth_token", "tok123");
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const error = { response: { status: 401 }, config: { url: "/assessments" } };
    await expect(responseHandler().onRejected(error)).rejects.toBe(error);
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth:session-expired" }),
    );
  });

  it("clears the token and dispatches session-expired on 403 as well", async () => {
    localStorage.setItem("auth_token", "tok123");
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const error = { response: { status: 403 }, config: { url: "/vacancies" } };
    await expect(responseHandler().onRejected(error)).rejects.toBe(error);
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it("exempts auth requests from the session-expired flow", async () => {
    localStorage.setItem("auth_token", "tok123");
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const error = { response: { status: 401 }, config: { url: "/auth/login" } };
    await expect(responseHandler().onRejected(error)).rejects.toBe(error);
    expect(localStorage.getItem("auth_token")).toBe("tok123");
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("rejects other errors without clearing credentials", async () => {
    localStorage.setItem("auth_token", "tok123");
    const error = { response: { status: 500 }, config: { url: "/assessments" } };
    await expect(responseHandler().onRejected(error)).rejects.toBe(error);
    expect(localStorage.getItem("auth_token")).toBe("tok123");
  });

  it("exposes the axios instance as the default export", () => {
    expect(api).toBeDefined();
    expect(typeof api.get).toBe("function");
    expect(typeof api.post).toBe("function");
    expect(typeof api.put).toBe("function");
    expect(typeof api.delete).toBe("function");
  });

  it("reads the API and WebSocket base URLs from the environment", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/v1");
    vi.stubEnv("VITE_WS_BASE_URL", "wss://ws.example.com");
    vi.resetModules();

    const { WS_URL: wsUrl } = await import("./api");
    expect(wsUrl).toBe("wss://ws.example.com");

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "https://api.example.com/v1" }),
    );

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
