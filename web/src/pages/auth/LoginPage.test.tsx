vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  return { ...actual, startRefreshTimer: vi.fn() };
});
vi.mock("@/stores/authAtom", () => ({
  setAuth: vi.fn(),
  clearAuth: vi.fn(),
  getAccessToken: vi.fn()
}));
vi.mock("@/services/auth", () => ({
  authApi: { login: vi.fn() }
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-handlers";
import { authApi } from "@/services/auth";
import LoginPage from "./LoginPage";

const BASE_URL = "http://localhost:3001/api/v1";

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  it("shows tenant_unresolved error when backend returns 422 tenant_unresolved", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockRejectedValue({
      response: {
        data: {
          errors: [
            { status: 422, message: "Unable to determine organization", code: "tenant_unresolved" }
          ]
        }
      }
    });

    renderLogin();

    await user.type(screen.getByLabelText("Email"), "user@test.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/unable to determine your organization/i)).toBeInTheDocument();
    });
  });

  it("shows invalid_credentials error when backend returns 401", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockRejectedValue({
      response: {
        data: {
          errors: [
            { status: 401, message: "Invalid email or password", code: "invalid_credentials" }
          ]
        }
      }
    });

    renderLogin();

    await user.type(screen.getByLabelText("Email"), "user@test.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });

  it("shows generic error on network failure", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockRejectedValue(new Error("Network Error"));

    renderLogin();

    await user.type(screen.getByLabelText("Email"), "user@test.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/an error occurred/i)).toBeInTheDocument();
    });
  });
});
