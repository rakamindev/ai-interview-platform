import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/pages/auth/LoginPage";
import { authApi } from "@/services/auth";
import { NETWORK_ERROR_MESSAGE } from "@/lib/apiError";

vi.mock("@/services/auth", () => ({ authApi: { login: vi.fn() } }));

function unauthorized() {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, {
    status: 401,
    statusText: "",
    headers: {},
    config,
    data: { errors: [{ message: "Invalid email or password" }] },
  });
}

async function submit() {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
  await user.type(screen.getByLabelText("Email"), "admin@example.com");
  await user.type(screen.getByLabelText("Password"), "wrong");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.mocked(authApi.login).mockReset();
  });

  it("reports wrong credentials", async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(unauthorized());
    await submit();

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("links back to the landing page and offers no self-registration", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Back to home/ })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: /sign up|register|create account/i })).toBeNull();
  });

  it("reports a connection problem instead of blaming the password", async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
    await submit();

    expect(await screen.findByText(NETWORK_ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("Invalid email or password.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
  });
});
