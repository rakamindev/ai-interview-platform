import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import ComparisonTable from "./ComparisonTable";
import type { SkillComparison } from "@/types";

afterEach(() => {
  cleanup();
});

const comparisons: SkillComparison[] = [
  {
    skill_label: "React / Frontend Development Core",
    skill_id: "react-core",
    expected_level: 3,
    candidate_level: 4,
    result: "exceed",
    delta: 1,
    confidence: "high",
    is_override: true,
  },
  {
    skill_label: "Kubernetes Operations",
    expected_level: 4,
    candidate_level: null,
    result: "not_assessed",
    is_override: false,
  },
];

describe("ComparisonTable", () => {
  it("renders the expected level in the Required column", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    const reactRow = screen.getByRole("row", { name: /React/ });
    expect(within(reactRow).getByText("L3")).toBeInTheDocument();

    const kubernetesRow = screen.getByRole("row", { name: /Kubernetes/ });
    expect(within(kubernetesRow).getByText("L4")).toBeInTheDocument();
  });

  it("marks overridden levels and leaves plain results unmarked", () => {
    render(<ComparisonTable comparisons={comparisons} />);

    const reactRow = screen.getByRole("row", { name: /React/ });
    expect(within(reactRow).getByText("L4")).toBeInTheDocument();
    expect(within(reactRow).getByText("✏")).toBeInTheDocument();

    const kubernetesRow = screen.getByRole("row", { name: /Kubernetes/ });
    expect(within(kubernetesRow).queryByText("✏")).not.toBeInTheDocument();
    expect(within(kubernetesRow).getByText(/not assessed/i)).toBeInTheDocument();
  });
});
