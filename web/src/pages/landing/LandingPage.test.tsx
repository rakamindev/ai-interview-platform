import { render, screen, within } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import App from "@/App";
import { authAtom } from "@/stores/authAtom";

function renderHome(token: string | null) {
  const store = createStore();
  store.set(authAtom, { token });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
}

describe("LandingPage", () => {
  it("is public and sends signed-out visitors to sign in", () => {
    renderHome(null);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Interviews that listen/);
    const signInLinks = screen.getAllByRole("link", { name: /Sign in/ });
    expect(signInLinks.length).toBeGreaterThan(0);
    signInLinks.forEach((link) => expect(link).toHaveAttribute("href", "/login"));
  });

  it("offers no self-registration, since accounts are provisioned by the organization", () => {
    renderHome(null);

    expect(screen.queryByRole("link", { name: /sign up|register|create account/i })).toBeNull();
    expect(document.querySelector('a[href="/register"], a[href="/signup"]')).toBeNull();
  });

  it("links signed-in assessors to their dashboard instead", () => {
    renderHome("token");

    const dashboardLinks = screen.getAllByRole("link", { name: /dashboard/i });
    dashboardLinks.forEach((link) => expect(link).toHaveAttribute("href", "/assessments"));
    expect(screen.queryByRole("link", { name: /Sign in/ })).toBeNull();
  });

  it("hides the sample product previews from assistive technology", () => {
    renderHome(null);

    const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
    expect(within(hero).queryByText("Live coverage")).toBeInTheDocument();
    expect(within(hero).getByText("Live coverage").closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("closes with a demo request instead of a third sign-in button", async () => {
    const user = userEvent.setup();
    renderHome(null);

    // Sign-in stays in the header and hero only.
    expect(screen.getAllByRole("link", { name: /Sign in/ })).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /Request a demo/ }));
    expect(screen.getByRole("dialog", { name: "Request a demo" })).toBeInTheDocument();
    expect(screen.queryByText(/walk you through|reach out/i)).toBeNull();
  });

  it("keeps repeated mobile cards in compact, keyboard-scrollable rails", () => {
    renderHome(null);

    const workflow = screen.getByRole("list", { name: "Assessment workflow" });
    const highlights = screen.getByRole("list", { name: "Product highlights" });

    [workflow, highlights].forEach((rail) => {
      expect(rail).toHaveAttribute("tabindex", "0");
      expect(rail).toHaveClass("overflow-x-auto", "grid-flow-col", "md:grid-flow-row");
    });

    expect(screen.getAllByText(/Swipe or scroll to see/i)).toHaveLength(2);
  });
});
