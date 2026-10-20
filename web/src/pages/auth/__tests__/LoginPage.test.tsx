import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LoginPage from "../LoginPage";
import { authApi } from "@/services/auth";

vi.mock("@/services/auth", () => ({
  authApi: {
    login: vi.fn(),
  },
}));

describe("LoginPage - Admin Portal Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders standardized Admin Portal header without icons in title", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    const heading = screen.getByRole("heading", { level: 1, name: /Admin Portal/i });
    expect(heading).toBeInTheDocument();
    expect(heading.querySelector("svg")).toBeNull();
    expect(
      screen.getByText(/Sign in with your administrator credentials to access the assessment workspace/i)
    ).toBeInTheDocument();
  });

  it("auto-fills demo credentials when clicking auto-fill button", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement;

    expect(emailInput.value).toBe("");
    expect(passwordInput.value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: /Auto-fill/i }));

    expect(emailInput.value).toBe("admin@example.com");
    expect(passwordInput.value).toBe("password");
  });

  it("submits login payload and redirects to /assessments upon success", async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      data: {
        token: "mock-jwt-token",
        user: { id: 1, email: "admin@example.com", role: "admin" },
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {} as any,
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/assessments" element={<div>Assessments Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: "admin@example.com",
        password: "password",
      });
      expect(localStorage.getItem("auth_token")).toBe("mock-jwt-token");
      expect(screen.getByText("Assessments Dashboard")).toBeInTheDocument();
    });
  });

  it("displays error alert when login fails", async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(new Error("Unauthorized"));

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "wrong@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "wrongpassword" } });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password.");
    });
  });
});
