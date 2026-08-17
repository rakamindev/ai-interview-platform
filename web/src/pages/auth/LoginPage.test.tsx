import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { fireEvent, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./LoginPage";

const { authApiMock } = vi.hoisted(() => ({
  authApiMock: { login: vi.fn(), signup: vi.fn(), me: vi.fn() },
}));

vi.mock("@/services/auth", () => ({ authApi: authApiMock }));

function apiError(status?: number) {
  return { isAxiosError: true, response: status ? { status } : undefined };
}

function renderLogin() {
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/assessments" element={<div>ASSESSMENTS</div>} />
    </Routes>,
    { route: "/login" },
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("signs in with trimmed credentials, stores the token and navigates", async () => {
    authApiMock.login.mockResolvedValue({ data: { token: "jwt" } });
    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "  user@rakamin.id  " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("ASSESSMENTS", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(authApiMock.login).toHaveBeenCalledWith({
      email: "user@rakamin.id",
      password: "secret",
    });
    expect(localStorage.getItem("auth_token")).toBe("jwt");
  });

  it("shows a loading state while the request is in flight", async () => {
    let resolveLogin!: (v: { data: { token: string } }) => void;
    authApiMock.login.mockReturnValue(
      new Promise<{ data: { token: string } }>((resolve) => {
        resolveLogin = resolve;
      }),
    );
    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();

    act(() => resolveLogin({ data: { token: "t" } }));
    expect(await screen.findByText("ASSESSMENTS", {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it("shows a credentials error on 401", async () => {
    authApiMock.login.mockRejectedValue(apiError(401));
    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Invalid email or password. Check your credentials and try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).not.toBeDisabled();
  });

  it("shows a connection error when the server is unreachable", async () => {
    authApiMock.login.mockRejectedValue(apiError());
    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Cannot reach the server. Check your connection and try again."),
    ).toBeInTheDocument();
  });

  it("shows a generic message for unexpected errors", async () => {
    authApiMock.login.mockRejectedValue(new Error("boom"));
    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.c" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Something went wrong on our end. Please try again in a moment."),
    ).toBeInTheDocument();
  });

  it("shows the session-expired banner from navigation state", () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>,
      { initialEntries: [{ pathname: "/login", state: { sessionExpired: true } }] },
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your session expired. Sign in again to continue.",
    );
  });

  it("shows the session-expired banner on the auth:session-expired window event", () => {
    renderLogin();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("auth:session-expired"));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your session expired. Sign in again to continue.",
    );
  });

  it("shows the caps-lock hint when the password key has caps lock on", () => {
    renderLogin();

    const event = new KeyboardEvent("keydown", { key: "a", bubbles: true });
    Object.defineProperty(event, "getModifierState", { value: () => true });
    fireEvent(screen.getByLabelText("Password"), event);

    expect(screen.getByText("Caps Lock is on.")).toBeInTheDocument();
  });

  it("links to the signup page", () => {
    renderLogin();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/signup",
    );
  });
});

describe("LoginPage (module-level helpers)", () => {
  it("never leaves stale alerts after a successful login", async () => {
    authApiMock.login
      .mockRejectedValueOnce(apiError(401))
      .mockResolvedValueOnce({ data: { token: "t" } });
    renderLogin();

    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");
    fireEvent.change(email, { target: { value: "a@b.c" } });
    fireEvent.change(password, { target: { value: "x" } });

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByText(/Invalid email or password/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("ASSESSMENTS", {}, { timeout: 5000 })).toBeInTheDocument();
  });
});

void MemoryRouter;
