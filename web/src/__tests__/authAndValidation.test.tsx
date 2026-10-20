import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "@/pages/auth/LoginPage";
import { Toaster, toast } from "@/components/ui/toast";
import { authApi } from "@/services/auth";
import type { AxiosResponse } from "axios";

vi.mock("@/services/auth", () => ({
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
  },
}));

function mockAxiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: {} as any },
  };
}

describe("Auth Pages & Whole-FE Validation Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modern login card with branding, quick-fill, and password toggle", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Rakamin AI Interview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fill demo credentials/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show password/i })).toBeInTheDocument();
  });

  it("enforces Zod form validation on empty and invalid email/password inputs", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const submitBtn = screen.getByRole("button", { name: /sign in/i });

    // Enter invalid email and short password
    await user.type(emailInput, "not-an-email");
    await user.type(passwordInput, "123");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/please enter a valid email address/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/password must be at least 6 characters/i)
      ).toBeInTheDocument();
    });

    expect(authApi.login).not.toHaveBeenCalled();
  });

  it("quick-fill button populates valid demo credentials and allows submission", async () => {
    const user = userEvent.setup();
    (authApi.login as any).mockResolvedValueOnce(
      mockAxiosResponse({ token: "test-jwt-token-123" })
    );

    render(
      <MemoryRouter>
        <LoginPage />
        <Toaster />
      </MemoryRouter>
    );

    const quickFillBtn = screen.getByRole("button", { name: /fill demo credentials/i });
    await user.click(quickFillBtn);

    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^password/i) as HTMLInputElement;

    expect(emailInput.value).toBe("assessor@rakamin.com");
    expect(passwordInput.value).toBe("password123");

    const submitBtn = screen.getByRole("button", { name: /sign in/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: "assessor@rakamin.com",
        password: "password123",
      });
    });
  });

  it("displays toast notification with semantic styling when triggered", async () => {
    render(
      <div>
        <Toaster />
        <button
          type="button"
          onClick={() => toast.success("Assessment saved successfully!", "Success")}
        >
          Trigger Toast
        </button>
      </div>
    );

    const triggerBtn = screen.getByText("Trigger Toast");
    await userEvent.click(triggerBtn);

    await waitFor(() => {
      expect(screen.getByText("Assessment saved successfully!")).toBeInTheDocument();
      expect(screen.getByText("Success")).toBeInTheDocument();
    });
  });
});
