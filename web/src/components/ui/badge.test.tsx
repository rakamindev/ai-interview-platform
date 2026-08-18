import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Gap</Badge>);
    expect(screen.getByText("Gap")).toBeInTheDocument();
  });

  it("applies default variant styling", () => {
    render(<Badge>Match</Badge>);
    // base-ui useRender keeps a data-slot attribute for state; default variant has no extra marker.
    expect(screen.getByText("Match")).toHaveAttribute("data-slot", "badge");
  });
});