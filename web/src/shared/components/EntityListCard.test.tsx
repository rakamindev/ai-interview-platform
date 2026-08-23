import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Briefcase } from "lucide-react";
import EntityListCard from "./EntityListCard";

describe("EntityListCard", () => {
  it("renders title, meta, and badges", () => {
    render(
      <EntityListCard
        onClick={() => {}}
        icon={Briefcase}
        title="Backend Engineer"
        meta={<span>3 candidates</span>}
        badges={["Ruby", "SQL"]}
      />,
    );
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("3 candidates")).toBeInTheDocument();
    expect(screen.getByText("Ruby")).toBeInTheDocument();
  });

  it("calls onClick when the card is clicked", () => {
    const onClick = vi.fn();
    render(<EntityListCard onClick={onClick} title="Backend Engineer" />);
    fireEvent.click(screen.getByText("Backend Engineer"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("falls back to a chevron when no trailing content is given", () => {
    const { container } = render(<EntityListCard onClick={() => {}} title="Backend Engineer" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
