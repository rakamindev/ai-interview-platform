import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";
import { api } from "./api";
import { sessionsApi } from "./sessions";

/**
 * Regression cover for the CV upload 400.
 *
 * axios converts a FormData payload to JSON when the request already claims a
 * JSON content type:
 *
 *   if (isFormData) return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
 *
 * The instance used to default to `Content-Type: application/json`, so every CV
 * was serialized to the body {"cv":{}} — the File became an empty object and the
 * API answered "CV file is required". These assertions catch that at the wiring
 * level instead of in a browser.
 */
describe("sessionsApi.uploadCv", () => {
  let captured: InternalAxiosRequestConfig | undefined;
  const originalAdapter = api.defaults.adapter;

  beforeEach(() => {
    captured = undefined;
    api.defaults.adapter = async (config) => {
      captured = config as InternalAxiosRequestConfig;
      return {
        data: { success: true, filename: "cv.pdf", text_length: 10, text_extracted: true, preview: "" },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it("keeps the payload as FormData so the browser can add the multipart boundary", async () => {
    const file = new File(["%PDF-1.4 fake cv"], "cv.pdf", { type: "application/pdf" });

    await sessionsApi.uploadCv("invite-token", file);

    expect(captured).toBeDefined();
    expect(captured!.data).toBeInstanceOf(FormData);

    const contentType = String(
      (captured!.headers as unknown as Record<string, unknown>)?.["Content-Type"] ?? ""
    ).toLowerCase();
    // A JSON content type makes axios stringify the FormData and drop the file.
    expect(contentType).not.toContain("application/json");
    // Declaring multipart ourselves would omit the boundary and break parsing,
    // so the header must be left for the browser to set.
    expect(contentType).not.toContain("multipart/form-data");
  });

  it("posts to the invite-token URL with the file in the cv field", async () => {
    const file = new File(["hello"], "cv.txt", { type: "text/plain" });

    await sessionsApi.uploadCv("abc123", file);

    expect(captured!.url).toBe("/sessions/abc123/cv");
    expect(captured!.method).toBe("post");
    const body = captured!.data as FormData;
    expect(body.get("cv")).toBeInstanceOf(File);
    expect((body.get("cv") as File).name).toBe("cv.txt");
  });
});

describe("JSON request handling", () => {
  let captured: InternalAxiosRequestConfig | undefined;
  const originalAdapter = api.defaults.adapter;

  beforeEach(() => {
    captured = undefined;
    api.defaults.adapter = async (config) => {
      captured = config as InternalAxiosRequestConfig;
      return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
    };
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it("still sends plain objects as JSON without an explicit default header", async () => {
    await sessionsApi.endSession(7, "manual_assessor");

    expect(typeof captured!.data).toBe("string");
    expect(captured!.data).toContain("manual_assessor");
    const contentType = String(
      (captured!.headers as unknown as Record<string, unknown>)?.["Content-Type"] ?? ""
    ).toLowerCase();
    expect(contentType).toContain("application/json");
  });
});
