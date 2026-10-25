import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import LoginPage from "./LoginPage";
import { authApi } from "../services/auth";

vi.mock("../services/auth", () => ({
  authApi: {
    login: vi.fn(),
  },
}));

describe("LoginPage Component", () => {
  it("renders email and password inputs, sign-in button, and quick-fill demo account buttons", () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fill Test Corp/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fill Acme Corp/i })).toBeInTheDocument();
  });

  it("autofills credentials when clicking Test Corp or Acme Corp quick-fill buttons", () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement;

    fireEvent.click(screen.getByRole("button", { name: /Fill Test Corp/i }));
    expect(emailInput.value).toBe("admin@example.com");
    expect(passwordInput.value).toBe("password123");

    fireEvent.click(screen.getByRole("button", { name: /Fill Acme Corp/i }));
    expect(emailInput.value).toBe("admin@acme.com");
    expect(passwordInput.value).toBe("password123");
  });

  it("shows error message when authentication fails", async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          errors: [{ status: 401, message: "Invalid email or password" }],
        },
      },
    });

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "wrong@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "wrongpass" } });
    fireEvent.click(screen.getByRole("button", { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
    });
  });

  it("shows descriptive message when connection to server fails", async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce({
      code: "ERR_NETWORK",
      message: "Network Error",
    });

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByText(/Unable to connect to the authentication server/i)
      ).toBeInTheDocument();
    });
  });

  it("clears error message when user modifies input", async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(new Error("Invalid credentials"));

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "wrong@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "wrongpass" } });
    fireEvent.click(screen.getByRole("button", { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "new@example.com" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("successfully signs in and saves token", async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      data: { token: "mock_jwt_token_123" },
    } as any);

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Fill Test Corp/i }));
    fireEvent.click(screen.getByRole("button", { name: /Sign in/i }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: "admin@example.com",
        password: "password123",
      });
    });
  });
});
