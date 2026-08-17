import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "@/pages/auth/LoginPage";
import { authApi } from "@/services/auth";

vi.mock("@/services/auth", () => ({
  authApi: { login: vi.fn() },
}));

const loginMock = vi.mocked(authApi.login);

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

  it("renders without validation errors and keeps submit disabled while empty", () => {
    renderPage();

    expect(screen.queryByText(/enter a valid email address/i)).toBeNull();
    expect(screen.queryByText(/password is required/i)).toBeNull();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
  });

  it("surfaces validation errors only after the field is touched", async () => {
    const user = userEvent.setup();
    renderPage();

    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/password/i);

    await user.click(email);
    await user.tab();
    expect(
      screen.getByText(/enter a valid email address/i)
    ).toBeInTheDocument();

    await user.click(password);
    await user.tab();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();

    expect(loginMock).not.toHaveBeenCalled();
  });

  it("enables submit and calls the API once the fields are valid", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValueOnce({
      data: { token: "tok-123", expires_in: 3600 },
    } as never);

    renderPage();

    await user.type(screen.getByLabelText(/email/i), "admin@test.corp");
    await user.type(screen.getByLabelText(/password/i), "Test1234!");

    expect(screen.queryByText(/enter a valid email address/i)).toBeNull();
    expect(screen.queryByText(/password is required/i)).toBeNull();

    const submit = screen.getByRole("button", { name: /sign in/i });
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(loginMock).toHaveBeenCalledWith({
      email: "admin@test.corp",
      password: "Test1234!",
    });
  });
});
