import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/pages/auth/LoginPage";
import { authApi } from "@/services/auth";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/services/auth", () => ({
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
  },
}));

const loginMock = authApi.login as ReturnType<typeof vi.fn>;

beforeEach(() => {
  navigateMock.mockReset();
  loginMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("LoginPage — tenant-implicit login (F-03 phase 2)", () => {
  it("renders email + password only — no tenant field", () => {
    renderLogin();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/tenant/i)).not.toBeInTheDocument();
  });

  it("toggles password visibility with the eye icon (UXI polish)", async () => {
    const user = userEvent.setup();
    renderLogin();

    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("sends email + password only and navigates on success (clean login, no scheme)", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({ data: { token: "tok123" } });
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), "assessor@test.corp");
    await user.type(screen.getByLabelText(/^password$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({ email: "assessor@test.corp", password: "Password123!" });
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/assessments"));
    expect(localStorage.getItem("auth_token")).toBe("tok123");
  });

  it("surfaces the backend error (e.g. account not assigned) instead of a generic one", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue({
      response: { status: 401, data: { error: { code: "unauthorized", message: "Account is not assigned to an organization" } } },
    });
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), "assessor@test.corp");
    await user.type(screen.getByLabelText(/^password$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Account is not assigned to an organization")).toBeInTheDocument();
    expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument();
  });

  it("surfaces network errors with the connection message instead of a generic one (F-26)", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(new Error("Network Error"));
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), "assessor@test.corp");
    await user.type(screen.getByLabelText(/^password$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Network Error")).toBeInTheDocument();
    expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument();
  });

  it("still parses the legacy errors array envelope (backward compat, F-26)", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue({
      response: { data: { errors: [{ status: 401, message: "Account is not assigned to an organization" }] } },
    });
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), "assessor@test.corp");
    await user.type(screen.getByLabelText(/^password$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Account is not assigned to an organization")).toBeInTheDocument();
  });

  it("does not advertise public signup from the login page", () => {
    renderLogin();

    expect(screen.queryByRole("link", { name: /sign up/i })).not.toBeInTheDocument();
  });

  it("blocks submit and shows field errors on empty submit (RHF validation)", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    // RHF validation blocks the API call entirely.
    expect(loginMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows the email format error on a malformed address (RHF mirror of backend)", async () => {
    const user = userEvent.setup();
    renderLogin();

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, "not-an-email");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });
});
