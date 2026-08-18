import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionStatusPill } from "./StatusPill";

describe("SessionStatusPill", () => {
  it("labels missing, live, failed, completed, and awaiting sessions", () => {
    const { rerender } = render(<SessionStatusPill />);
    expect(screen.getByText("No session yet")).toBeInTheDocument();

    rerender(<SessionStatusPill session={{ status: "active" }} />);
    expect(screen.getByText("Live now")).toBeInTheDocument();

    rerender(<SessionStatusPill session={{ status: "ended", end_reason: "error" }} />);
    expect(screen.getByText("Last failed")).toBeInTheDocument();

    rerender(<SessionStatusPill session={{ status: "ended", end_reason: "all_covered" }} />);
    expect(screen.getByText("Completed")).toBeInTheDocument();

    rerender(<SessionStatusPill session={{ status: "pending" }} />);
    expect(screen.getByText("Awaiting candidate")).toBeInTheDocument();
  });
});
