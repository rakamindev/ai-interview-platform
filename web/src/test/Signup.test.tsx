import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignupPage from "@/pages/auth/SignupPage";
import LoginPage from "@/pages/auth/LoginPage";
import { authApi } from "@/services/auth";

vi.mock("@/services/auth", () => ({ authApi: { signup: vi.fn() } }));
const signup = vi.mocked(authApi.signup);

const LOGIN_HEADING = "Sign in to your account";

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/signup"]}>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "admin@example.com");
  await user.type(screen.getByLabelText("Password"), "secret1234");
  await user.click(screen.getByRole("button", { name: /sign up/i }));
}

function apiError(status: number, message: string) {
  return new AxiosError(
    "Request failed",
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    {
      status,
      data: { errors: [{ message }] },
    } as never,
  );
}

describe("SignupPage", () => {
  beforeEach(() => {
    // Braces matter: returning the mock from a hook makes Vitest call it as cleanup.
    signup.mockReset();
  });

  it("sends email + password and redirects to the login page on success", async () => {
    signup.mockResolvedValue({} as never);
    renderPage();
    await fillAndSubmit();

    expect(signup).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "secret1234",
    });
    expect(await screen.findByText(LOGIN_HEADING)).toBeInTheDocument();
  });

  it("shows a loading state while the request is pending", async () => {
    signup.mockReturnValue(new Promise(() => {})); // never resolves = slow connection
    renderPage();
    await fillAndSubmit();

    const button = await screen.findByRole("button", { name: /sign up/i });
    await waitFor(() => expect(button).toBeDisabled());
    expect(button.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows the backend message for a duplicate email and re-enables the form", async () => {
    signup.mockRejectedValue(apiError(422, "Email has already been taken"));
    renderPage();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email has already been taken",
    );
    const button = screen.getByRole("button", { name: /sign up/i });
    expect(button).toBeEnabled();
    expect(button.querySelector(".animate-spin")).not.toBeInTheDocument();
    expect(screen.queryByText(LOGIN_HEADING)).not.toBeInTheDocument();
    expect(screen.getByText("Create an account")).toBeInTheDocument();
  });

  it("clears the previous error when submitting again", async () => {
    signup.mockRejectedValueOnce(apiError(422, "Email has already been taken"));
    signup.mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    await fillAndSubmit();
    await screen.findByRole("alert");

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /sign up/i }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });
});
