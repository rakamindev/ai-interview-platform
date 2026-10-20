import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { authApi } from "@/services/auth";
import { AUTH_NOTICE_KEY } from "@/services/api";

const navigate = vi.fn();
vi.mock("react-router-dom", async orig => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
vi.mock("@/services/auth", () => ({ authApi: { login: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
import { toast } from "sonner";
import LoginPage from "@/pages/auth/LoginPage";

const renderPage = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText("Email"), "a@mail.com");
  await userEvent.type(screen.getByLabelText("Password"), "secret123");
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("LoginPage", () => {
  it("goes to /assessments after a successful login", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      data: { token: "t" },
    } as never);
    renderPage();
    await fillAndSubmit();
    expect(toast.success).toHaveBeenCalledWith("Signed in successfully");
    expect(navigate).toHaveBeenCalledWith("/assessments", { replace: true });
  });

  it("shows a generic message on 401", async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      Object.assign(new AxiosError("x"), { response: { status: 401 } }),
    );
    renderPage();
    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows the expired-session notice left by the interceptor, once", () => {
    sessionStorage.setItem(AUTH_NOTICE_KEY, "Your session has expired.");
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your session has expired.",
    );
    expect(sessionStorage.getItem(AUTH_NOTICE_KEY)).toBeNull();
  });
});
