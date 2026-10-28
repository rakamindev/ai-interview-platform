import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/pages/auth/LoginPage";
import { authApi } from "@/services/auth";

vi.mock("@/services/auth", () => ({ authApi: { login: vi.fn() } }));

function renderPage() {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
}

afterEach(() => vi.resetAllMocks());

// The login page was a bare form titled "AI Interview". It now carries the
// product name, says what the account is for, lets the assessor check the
// password they typed, and says who manages accounts.
describe("LoginPage", () => {
    it("shows the product name, a clear title and a helper line", () => {
        renderPage();

        expect(screen.getByText("Rakamin AI Interview")).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 1, name: "Sign in to the assessor panel" })).toBeInTheDocument();
        expect(screen.getByText("Use the email and password of your account.")).toBeInTheDocument();
        expect(screen.getByText(/Accounts are managed by your administrator/)).toBeInTheDocument();
        expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "name@company.com");
    });

    it("shows and hides the password with a named toggle", () => {
        renderPage();
        const password = screen.getByLabelText("Password");
        expect(password).toHaveAttribute("type", "password");

        const toggle = screen.getByRole("button", { name: "Show password" });
        expect(toggle).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(toggle);

        expect(password).toHaveAttribute("type", "text");
        expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
    });

    it("announces a failed sign in and keeps the email", async () => {
        vi.mocked(authApi.login).mockRejectedValue(new Error("unauthorized"));
        renderPage();
        fireEvent.change(screen.getByLabelText("Email"), { target: { value: "contoh@perusahaan.test" } });
        fireEvent.change(screen.getByLabelText("Password"), { target: { value: "contoh-sandi" } });

        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign in" })); });

        expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password.");
        expect(screen.getByLabelText("Email")).toHaveValue("contoh@perusahaan.test");
    });

    it("cannot be submitted twice while signing in", async () => {
        vi.mocked(authApi.login).mockReturnValue(new Promise(() => {}) as never);
        renderPage();
        fireEvent.change(screen.getByLabelText("Email"), { target: { value: "contoh@perusahaan.test" } });
        fireEvent.change(screen.getByLabelText("Password"), { target: { value: "contoh-sandi" } });

        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign in" })); });

        expect(screen.getByRole("button", { name: /Signing in/ })).toBeDisabled();
        expect(authApi.login).toHaveBeenCalledTimes(1);
    });
});
