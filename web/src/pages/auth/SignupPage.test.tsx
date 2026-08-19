import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { fireEvent, screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import SignupPage from "./SignupPage";

const { authApiMock } = vi.hoisted(() => ({
  authApiMock: { login: vi.fn(), signup: vi.fn(), me: vi.fn() },
}));

vi.mock("@/services/auth", () => ({ authApi: authApiMock }));

function apiError(status?: number, detail?: unknown) {
  return {
    isAxiosError: true,
    response: status ? { status, data: detail ? { errors: [{ detail }] } : undefined } : undefined,
  };
}

function renderSignup() {
  renderWithProviders(
    <Routes>
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/assessments" element={<div>ASSESSMENTS</div>} />
    </Routes>,
    { route: "/signup" },
  );
}

function fillForm(email = "user@rakamin.id", password = "password123") {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("signs up as user, stores the token and navigates", async () => {
    authApiMock.signup.mockResolvedValue({ data: { token: "jwt" } });
    renderSignup();

    fillForm("  user@rakamin.id  ");
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByText("ASSESSMENTS", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(authApiMock.signup).toHaveBeenCalledWith({
      email: "user@rakamin.id",
      password: "password123",
    });
    expect(localStorage.getItem("auth_token")).toBe("jwt");
  });

  it("shows field errors returned by the server on 422", async () => {
    authApiMock.signup.mockRejectedValue(apiError(422, { email: ["is invalid"] }));
    renderSignup();

    fillForm("invalid@rakamin.id");
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByText("is invalid")).toBeInTheDocument();
    expect(
      screen.getByText("Signup failed. Check the highlighted fields and try again."),
    ).toBeInTheDocument();
  });

  it("shows a connection error when the server is unreachable", async () => {
    authApiMock.signup.mockRejectedValue(apiError());
    renderSignup();

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(
      await screen.findByText("Cannot reach the server. Check your connection and try again."),
    ).toBeInTheDocument();
  });

  it("shows a generic error for unexpected failures", async () => {
    authApiMock.signup.mockRejectedValue(new Error("boom"));
    renderSignup();

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(
      await screen.findByText("Signup failed. Check your details and try again."),
    ).toBeInTheDocument();
  });

  it("shows the caps-lock hint and the password length hint", () => {
    renderSignup();

    expect(screen.getByText("At least 8 characters.")).toBeInTheDocument();
    const event = new KeyboardEvent("keydown", { key: "a", bubbles: true });
    Object.defineProperty(event, "getModifierState", { value: () => true });
    fireEvent(screen.getByLabelText("Password"), event);

    expect(screen.getByText("Caps Lock is on.")).toBeInTheDocument();
  });

  it("links to the login page", () => {
    renderSignup();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("highlights the password field when the server returns a password error", async () => {
    authApiMock.signup.mockRejectedValue(apiError(422, { password: ["is too short"] }));
    renderSignup();

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByText("is too short")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows the generic message for an axios error that is not a 422", async () => {
    authApiMock.signup.mockRejectedValue(apiError(500));
    renderSignup();

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(
      await screen.findByText("Signup failed. Check your details and try again."),
    ).toBeInTheDocument();
  });

  it("ignores a non-object error detail while still showing the 422 message", async () => {
    authApiMock.signup.mockRejectedValue(apiError(422, "not an object"));
    renderSignup();

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(
      await screen.findByText("Signup failed. Check the highlighted fields and try again."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert", { name: /email|password/i })).not.toBeInTheDocument();
  });
});
