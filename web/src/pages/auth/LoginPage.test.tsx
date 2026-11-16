import { describe, it, expect, vi, beforeEach } from "vitest";
import { Routes, Route } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import type { InternalAxiosRequestConfig } from "axios";
import LoginPage from "./LoginPage";
import api from "@/services/api";
import { authAtom } from "@/stores/authAtom";
import { renderWithProviders } from "@/test/renderWithProviders";

// Stub at the HTTP layer so the real authApi + api interceptors run.
type Reply = { status: number; data: unknown };
let requests: InternalAxiosRequestConfig[] = [];
function stubHttp(reply: Reply | Promise<Reply>) {
  api.defaults.adapter = async (config) => {
    requests.push(config);
    const { status, data } = await reply;
    const response = { data, status, statusText: "", headers: {}, config };
    if (status >= 400) throw Object.assign(new Error(`HTTP ${status}`), { response, config });
    return response;
  };
}

function setup() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/hr/dashboard" element={<div>assessments page</div>} />
    </Routes>,
    { route: "/login" }
  );
}

async function fillAndSubmit(email = "a@b.co", password = "pw123456") {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    requests = [];
    vi.stubGlobal("location", { href: "/login" });
  });

  it("submits credentials, stores the token and navigates", async () => {
    stubHttp({ status: 200, data: { data: { token: "jwt-123" } } });
    const { store } = setup();
    await fillAndSubmit();

    expect(await screen.findByText("assessments")).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("/auth/login");
    expect(JSON.parse(requests[0].data)).toEqual({ email: "a@b.co", password: "pw123456" });
    expect(localStorage.getItem("auth_token")).toBe("jwt-123");
    expect(store.get(authAtom)).toEqual({ token: "jwt-123" });
  });

  it("shows an error and stays on the page when login fails", async () => {
    stubHttp({ status: 500, data: {} });
    setup();
    await fillAndSubmit();

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(screen.queryByText("assessments page")).not.toBeInTheDocument();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("disables the button while the request is in flight", async () => {
    let resolve!: (r: Reply) => void;
    stubHttp(new Promise<Reply>((r) => (resolve = r)));
    setup();
    await fillAndSubmit();

    expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
    resolve({ status: 200, data: { data: { token: "t" } } });
    await waitFor(() => expect(screen.getByText("assessments page")).toBeInTheDocument());
  });
});
