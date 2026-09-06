import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Provider as JotaiProvider } from "jotai";
import LoginPage from "./LoginPage";
import { authApi } from "@/services/auth";

vi.mock("@/services/auth", () => ({
  authApi: { login: vi.fn(), signup: vi.fn() },
}));

vi.mock("@/services/health", () => ({
  healthApi: { check: vi.fn().mockResolvedValue({ data: { status: "ok" } }) },
}));

function renderLogin() {
  return render(
    <JotaiProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/assessments" element={<div>Assessments page</div>} />
        </Routes>
      </MemoryRouter>
    </JotaiProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (authApi.login as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { token: "jwt-token" },
    });
  });

  it("logs in, stores the token, and redirects to /assessments", async () => {
    const user = userEvent.setup();
    renderLogin();

    expect(await screen.findByText("Backend online")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "admin@test.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(authApi.login).toHaveBeenCalledWith({
      email: "admin@test.com",
      password: "password123",
    });
    expect(localStorage.getItem("auth_token")).toBe("jwt-token");
    expect(await screen.findByText("Assessments page")).toBeInTheDocument();
  });

  it("shows an error and stays on the login page when login fails", async () => {
    (authApi.login as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("unauthorized")
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Email"), "admin@test.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(screen.queryByText("Assessments page")).not.toBeInTheDocument();
  });
});