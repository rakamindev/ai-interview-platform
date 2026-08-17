import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import AssessorLayout from "@/components/layout/AssessorLayout";

const { pathname } = vi.hoisted(() => ({ pathname: { value: "/candidates" } }));

vi.mock("react-router-dom", () => ({
  Outlet: () => <div data-testid="outlet" />,
  Link: ({ children, to, ...rest }: any) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: pathname.value }),
}));

vi.mock("jotai", () => ({
  useAtomValue: () => ({ name: "Demo Tenant" }),
  useSetAtom: () => vi.fn(),
  atom: (v: unknown) => v,
}));

vi.mock("@/stores/tenantAtom", () => ({ tenantAtom: {} }));
vi.mock("@/stores/authAtom", () => ({ authAtom: {}, clearToken: vi.fn() }));

describe("AssessorLayout header", () => {
  it("keeps every destination reachable on a phone, without a menu button", () => {
    // Three destinations do not earn a hamburger. The nav gets its own row
    // below sm instead, so reaching a section stays one tap.
    render(<AssessorLayout />);

    const navs = screen.getAllByRole("navigation", { name: "Main" });
    expect(navs.length).toBe(2);

    const mobileNav = navs.find((n) => n.closest(".sm\\:hidden"));
    expect(mobileNav).toBeDefined();
    for (const label of ["Candidates", "Assessments", "Vacancies"]) {
      expect(within(mobileNav as HTMLElement).getByText(label)).toBeInTheDocument();
    }
  });

  it("drops the wordmark before it drops a nav item", () => {
    // When space runs out the icon still identifies the product; the nav does
    // not identify itself by anything else.
    const { container } = render(<AssessorLayout />);

    const wordmark = screen.getAllByText("Rakamin AI Interview")[0];
    expect(wordmark.className).toContain("hidden");
    expect(wordmark.className).toContain("sm:inline");

    // ...and it stays announced to screen readers at every width.
    expect(container.querySelector(".sr-only")).not.toBeNull();
  });

  it("marks the section you are in, not just colours it", () => {
    pathname.value = "/vacancies";
    render(<AssessorLayout />);

    const current = screen.getAllByText("Vacancies")[0].closest("a");
    expect(current).toHaveAttribute("aria-current", "page");

    const other = screen.getAllByText("Candidates")[0].closest("a");
    expect(other).not.toHaveAttribute("aria-current");
  });

  it("hides the tenant chip on narrow screens rather than letting it squeeze the nav", () => {
    render(<AssessorLayout />);

    const chip = screen.getByText(/Demo Tenant/);
    expect(chip.className).toContain("hidden");
    expect(chip.className).toContain("lg:inline");
  });
});
