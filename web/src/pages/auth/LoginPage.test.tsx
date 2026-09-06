import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "./LoginPage";
import { authApi } from "@/services/auth";

vi.mock("@/services/auth", () => ({
  authApi: { login: vi.fn() },
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("logs in and navigates to /assessments on valid credentials", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      data: { token: "fake.jwt.token" },
    } as never);

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "admin@test-corp.com");
    await user.type(screen.getByLabelText(/^password$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/assessments");
    });
    expect(authApi.login).toHaveBeenCalledWith({
      email: "admin@test-corp.com",
      password: "Password123!",
    });
    expect(localStorage.getItem("auth_token")).toBe("fake.jwt.token");
  });

  it("shows an error message and does not navigate on invalid credentials", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error("Unauthorized"));

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "admin@test-corp.com");
    await user.type(screen.getByLabelText(/^password$/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("toggles the password field between hidden and visible", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
