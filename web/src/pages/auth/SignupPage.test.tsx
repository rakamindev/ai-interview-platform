import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Provider as JotaiProvider } from "jotai";
import SignupPage from "./SignupPage";
import { authApi } from "@/services/auth";

vi.mock("@/services/auth", () => ({
  authApi: { login: vi.fn(), signup: vi.fn() },
}));

vi.mock("@/services/health", () => ({
  healthApi: { check: vi.fn().mockResolvedValue({ data: { status: "ok" } }) },
}));

function renderSignup() {
  return render(
    <JotaiProvider>
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/assessments" element={<div>Assessments page</div>} />
        </Routes>
      </MemoryRouter>
    </JotaiProvider>
  );
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  {
    email = "new@test.com",
    password = "password123",
    confirmPassword = "password123",
  } = {}
) {
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.type(screen.getByLabelText("Confirm password"), confirmPassword);
  await user.click(screen.getByRole("button", { name: "Sign up" }));
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows validation errors for an empty submit", async () => {
    const user = userEvent.setup();
    renderSignup();

    expect(await screen.findByText("Backend online")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByText("Please enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(authApi.signup).not.toHaveBeenCalled();
  });

  it("shows a mismatch error when passwords differ", async () => {
    const user = userEvent.setup();
    renderSignup();

    await fillForm(user, { confirmPassword: "password1234" });

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(authApi.signup).not.toHaveBeenCalled();
  });

  it("signs up without a role, stores the token, and redirects to /assessments", async () => {
    (authApi.signup as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { token: "jwt-token" },
    });
    const user = userEvent.setup();
    renderSignup();

    await fillForm(user);

    expect(authApi.signup).toHaveBeenCalledTimes(1);
    const payload = (authApi.signup as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual({ email: "new@test.com", password: "password123" });

    expect(localStorage.getItem("auth_token")).toBe("jwt-token");
    expect(await screen.findByText("Assessments page")).toBeInTheDocument();
  });

  it("keeps the user on the page and shows the backend error message", async () => {
    (authApi.signup as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: {
        data: { errors: [{ status: 422, message: "Email has already been taken" }] },
      },
    });
    const user = userEvent.setup();
    renderSignup();

    await fillForm(user);

    expect(await screen.findByText("Email has already been taken")).toBeInTheDocument();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(screen.queryByText("Assessments page")).not.toBeInTheDocument();
  });
});