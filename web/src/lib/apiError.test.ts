import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { FORBIDDEN_MESSAGE, NETWORK_ERROR_MESSAGE, getApiErrorMessage } from "@/lib/apiError";

function responseError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data,
  });
}

describe("getApiErrorMessage", () => {
  it("returns the backend's first error message", () => {
    const error = responseError(422, { errors: [{ message: "Name can't be blank" }] });
    expect(getApiErrorMessage(error, "Failed.")).toBe("Name can't be blank");
  });

  it("falls back when the backend sends no message", () => {
    expect(getApiErrorMessage(responseError(500, {}), "Failed.")).toBe("Failed.");
  });

  it("explains a request that never reached the server", () => {
    const error = new AxiosError("Network Error", "ERR_NETWORK");
    expect(getApiErrorMessage(error, "Failed.")).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("explains a forbidden request as a permission problem", () => {
    const error = responseError(403, { errors: [{ message: "Unauthorized request" }] });
    expect(getApiErrorMessage(error, "Failed.")).toBe(FORBIDDEN_MESSAGE);
  });

  it("falls back for non-HTTP errors", () => {
    expect(getApiErrorMessage(new Error("boom"), "Failed.")).toBe("Failed.");
  });
});
