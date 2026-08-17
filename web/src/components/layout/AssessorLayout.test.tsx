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
  it("shows every destination on a phone rather than hiding them behind a menu", () => {
    // Nielsen Norman measured a 20%+ drop in discoverability for hidden
    // navigation and recommends showing links outright at four or fewer.
    render(<AssessorLayout />);

    const bar = screen.getByTestId("mobile-nav");
    for (const label of ["Candidates", "Assessments", "Vacancies"]) {
      expect(within(bar).getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();
  });

  it("puts the phone navigation in the thumb's path, not out of reach at the top", () => {
    // The top of a phone screen is the hardest place to reach one-handed,
    // which is why Material and the HIG both anchor primary destinations low.
    render(<AssessorLayout />);

    const bar = screen.getByTestId("mobile-nav");
    expect(bar.className).toContain("fixed");
    expect(bar.className).toContain("bottom-0");
    expect(bar.className).toContain("sm:hidden");
  });

  it("keeps a label under every icon", () => {
    // An icon on its own is a guess, and these three are not universal.
    const bar = (render(<AssessorLayout />), screen.getByTestId("mobile-nav"));
    const links = within(bar).getAllByRole("link");

    expect(links).toHaveLength(3);
    for (const link of links) expect(link.textContent?.trim()).not.toBe("");
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

  it("leaves room so the bar never covers the last row of a list", () => {
    const { container } = render(<AssessorLayout />);

    const main = container.querySelector("main");
    expect(main?.className).toContain("pb-20");
    expect(main?.className).toContain("sm:pb-6");
  });

  it("hides the tenant chip on narrow screens rather than letting it squeeze the nav", () => {
    render(<AssessorLayout />);

    const chip = screen.getByText(/Demo Tenant/);
    expect(chip.className).toContain("hidden");
    expect(chip.className).toContain("lg:inline");
  });
});
