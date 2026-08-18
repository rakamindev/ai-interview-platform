import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Breadcrumb from "@/components/layout/Breadcrumb";

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...rest }: any) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

describe("Breadcrumb", () => {
  it("offers a real button back to the nearest parent", () => {
    render(
      <Breadcrumb
        crumbs={[
          { label: "Assessments", to: "/assessments" },
          { label: "Senior Backend Engineer", to: "/assessments/1/invite" },
          { label: "Live Monitor" },
        ]}
      />,
    );

    const back = screen.getByRole("link", { name: /back to senior backend engineer/i });
    expect(back).toHaveAttribute("href", "/assessments/1/invite");
  });

  it("skips over a parent that is only a label, not a destination", () => {
    // The candidate's name sits in the trail for orientation but has no page
    // of its own, so stepping back has to reach past it.
    render(
      <Breadcrumb
        crumbs={[
          { label: "Assessments", to: "/assessments" },
          { label: "Senior Backend Engineer", to: "/assessments/1/invite" },
          { label: "Rani Prameswari" },
          { label: "Portfolio" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: /back to senior backend engineer/i })).toBeInTheDocument();
  });

  it("shows no back button at the top of the tree", () => {
    render(<Breadcrumb crumbs={[{ label: "Candidates" }]} />);

    expect(screen.queryByRole("link", { name: /back to/i })).toBeNull();
  });

  it("marks the last crumb as the current page", () => {
    render(
      <Breadcrumb
        crumbs={[{ label: "Assessments", to: "/assessments" }, { label: "Live Monitor" }]}
      />,
    );

    expect(screen.getByText("Live Monitor")).toHaveAttribute("aria-current", "page");
  });

  it("never links the crumb you are already on", () => {
    render(
      <Breadcrumb
        crumbs={[
          { label: "Assessments", to: "/assessments" },
          { label: "Portfolio", to: "/assessments/1/sessions/2/portfolio" },
        ]}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.querySelectorAll("a")).toHaveLength(1);
  });
});
