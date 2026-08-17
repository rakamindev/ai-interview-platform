import { describe, it, expect } from "vite-plus/test";
import { screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import App from "./App";

describe("App routing", () => {
  it("renders the login route through the lazy Suspense boundary", async () => {
    renderWithProviders(<App />, { route: "/login" });
    expect(
      await screen.findByText("Welcome back", undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it("redirects to login when a session-expired event fires off the login page", async () => {
    renderWithProviders(<App />, { route: "/signup" });
    // Wait for the lazy signup page (and the sibling SessionExpiredHandler) to mount
    // so the window listener is attached before we dispatch.
    expect(
      await screen.findByRole("button", { name: /sign up/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
    fireEvent(window, new Event("auth:session-expired"));
    expect(
      await screen.findByText("Welcome back", undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it("ignores the session-expired event while already on the login page", async () => {
    renderWithProviders(<App />, { route: "/login" });
    expect(
      await screen.findByText("Welcome back", undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    fireEvent(window, new Event("auth:session-expired"));
    // Still on the login page (early-return branch); no crash, content remains.
    expect(
      await screen.findByText("Welcome back", undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});
