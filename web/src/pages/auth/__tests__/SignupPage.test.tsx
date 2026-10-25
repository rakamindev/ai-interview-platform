import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignUpPage from "@/pages/auth/SignupPage";
import { authApi } from "@/services/auth";
import { adminInvitationsApi } from "@/services/adminInvitations";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/services/auth", () => ({
  authApi: { login: vi.fn(), signup: vi.fn() },
}));

vi.mock("@/services/adminInvitations", () => ({
  adminInvitationsApi: {
    validate: vi.fn(),
  },
}));

const signupMock = authApi.signup as ReturnType<typeof vi.fn>;
const validateMock = adminInvitationsApi.validate as ReturnType<typeof vi.fn>;

const VALID_INVITATION = {
  recipient_email: "invited@example.com",
  expires_at: "2026-10-25T00:00:00Z",
  organization: { name: "Tenant A" },
};

beforeEach(() => {
  localStorage.clear();
  navigateMock.mockReset();
  signupMock.mockReset();
  validateMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderSignup(entry = "/signup?invitation=valid-token") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/signup" element={<SignUpPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function renderValidSignup() {
  validateMock.mockResolvedValue({ data: { invitation: VALID_INVITATION } });
  renderSignup();
  await screen.findByDisplayValue("Tenant A");
}

describe("SignUpPage — invitation-gated administrator signup", () => {
  it("blocks public signup without an invitation and never loads the organization list", () => {
    renderSignup("/signup");

    expect(screen.getByText(/administrator invitation is required/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign up/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /organization/i })).not.toBeInTheDocument();
    expect(validateMock).not.toHaveBeenCalled();
  });

  it("validates the URL token and renders invitation tenant disabled with bound email read-only", async () => {
    await renderValidSignup();

    expect(validateMock).toHaveBeenCalledWith("valid-token");
    const organization = screen.getByLabelText(/organization/i);
    expect(organization).toBeDisabled();
    expect(organization).toHaveValue("Tenant A");
    expect(screen.getByLabelText(/email/i)).toHaveValue("invited@example.com");
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("readonly");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("submits token, bound email, and password only, then navigates on success", async () => {
    signupMock.mockResolvedValue({ data: { token: "tok123" } });
    await renderValidSignup();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^password$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(signupMock).toHaveBeenCalledWith({
        invitation_token: "valid-token",
        email: "invited@example.com",
        password: "Password123!",
      });
    });
    const payload = signupMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty("organization_id");
    expect(payload).not.toHaveProperty("role");
    expect(localStorage.getItem("auth_token")).toBe("tok123");
    expect(navigateMock).toHaveBeenCalledWith("/assessments");
  });

  it("renders a generic unavailable state for invalid, expired, revoked, or used tokens", async () => {
    validateMock.mockRejectedValue({
      response: { status: 422, data: { error: { code: "invalid_invitation", message: "Invitation is invalid" } } },
    });
    renderSignup();

    expect(await screen.findByText(/this invitation is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/invalid, expired, revoked, or already used/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign up/i })).not.toBeInTheDocument();
  });

  it("distinguishes network failure and retries validation", async () => {
    validateMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ data: { invitation: VALID_INVITATION } });
    renderSignup();

    expect(await screen.findByText(/unable to validate the invitation/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByDisplayValue("Tenant A")).toBeInTheDocument();
    expect(validateMock).toHaveBeenCalledTimes(2);
  });

  it("toggles password visibility and mirrors the backend password policy", async () => {
    await renderValidSignup();
    const password = screen.getByLabelText(/^password$/i);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(password).toHaveAttribute("type", "text");
    await user.type(password, "short");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(await screen.findByText("Password must be between 8 and 72 characters.")).toBeInTheDocument();
    expect(signupMock).not.toHaveBeenCalled();
  });

  it("surfaces a duplicate-email error without reporting success", async () => {
    signupMock.mockRejectedValue({
      response: { status: 422, data: { error: { code: "validation_failed", message: "Email has already been taken" } } },
    });
    await renderValidSignup();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^password$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(await screen.findByText("Email has already been taken")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
