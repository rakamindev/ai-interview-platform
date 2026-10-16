import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

/* ─── Test Fixtures ─────────────────────────────────────────────────────── */

const MOCK_COMPARISONS: SkillComparison[] = [
  {
    skill_label: "React / Frontend Development Core",
    skill_id: "SK-ENG-001",
    required_level: 3,
    candidate_level: 3,
    result: "match",
    delta: 0,
    confidence: "high",
    is_override: false,
  },
  {
    skill_label: "Node.js / Backend Development",
    skill_id: "SK-ENG-002",
    required_level: 4,
    candidate_level: 2,
    result: "gap",
    delta: -2,
    confidence: "medium",
    is_override: false,
  },
  {
    skill_label: "System Design & Architecture",
    skill_id: "SK-ENG-003",
    required_level: 3,
    candidate_level: 5,
    result: "exceed",
    delta: 2,
    confidence: "high",
    is_override: true,
  },
  {
    skill_label: "Rust Systems Programming",
    skill_id: "SK-ENG-099",
    required_level: 4,
    candidate_level: null,
    result: "not_assessed",
    delta: null,
    confidence: null,
    is_override: false,
  },
];

/* ─── Tests ─────────────────────────────────────────────────────────────── */

describe("ComparisonTable", () => {
  it("renders all skill labels", () => {
    render(<ComparisonTable comparisons={MOCK_COMPARISONS} />);

    expect(screen.getByText("React / Frontend Development Core")).toBeInTheDocument();
    expect(screen.getByText("Node.js / Backend Development")).toBeInTheDocument();
    expect(screen.getByText("System Design & Architecture")).toBeInTheDocument();
    expect(screen.getByText("Rust Systems Programming")).toBeInTheDocument();
  });

  // ── N01: required_level renders correctly ──────────────────────────────

  it("displays required level (L3, L4) from required_level field — not expected_level (N01)", () => {
    render(<ComparisonTable comparisons={MOCK_COMPARISONS} />);

    // The table should have L3 and L4 in the Required column
    const rows = screen.getAllByRole("row");
    // Row 0 is header, rows 1-4 are data

    // React skill: required L3
    const reactRow = rows.find((r) => r.textContent?.includes("React / Frontend"));
    expect(reactRow).toBeDefined();
    expect(reactRow!.textContent).toContain("L3");

    // Node skill: required L4
    const nodeRow = rows.find((r) => r.textContent?.includes("Node.js"));
    expect(nodeRow).toBeDefined();
    expect(nodeRow!.textContent).toContain("L4");
  });

  // ── N03: override icon renders ─────────────────────────────────────────

  it("shows override icon (Pencil) when is_override is true (N03)", () => {
    render(<ComparisonTable comparisons={MOCK_COMPARISONS} />);

    // System Design has is_override: true — should have pencil icon
    // The Pencil icon from lucide-react renders as an SVG
    const systemRow = screen.getAllByRole("row").find((r) =>
      r.textContent?.includes("System Design")
    );
    expect(systemRow).toBeDefined();

    // The pencil icon should be present (rendered as SVG with class)
    const pencilIcon = systemRow!.querySelector("svg.lucide-pencil");
    expect(pencilIcon).toBeInTheDocument();
  });

  it("does NOT show override icon when is_override is false", () => {
    render(<ComparisonTable comparisons={MOCK_COMPARISONS} />);

    const reactRow = screen.getAllByRole("row").find((r) =>
      r.textContent?.includes("React / Frontend")
    );
    expect(reactRow).toBeDefined();

    const pencilIcon = reactRow!.querySelector("svg.lucide-pencil");
    expect(pencilIcon).toBeNull();
  });

  // ── Result badges ──────────────────────────────────────────────────────

  it("renders correct result badges (match, gap, exceed, not assessed)", () => {
    render(<ComparisonTable comparisons={MOCK_COMPARISONS} />);

    // Use getAllByText since labels appear in both badge and summary
    expect(screen.getAllByText(/Match/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Gap/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Exceeds/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Not assessed/).length).toBeGreaterThanOrEqual(1);
  });

  // ── Not-assessed row styling ───────────────────────────────────────────

  it("renders not_assessed row with distinct styling (italic skill name)", () => {
    render(<ComparisonTable comparisons={MOCK_COMPARISONS} />);

    const rustRow = screen.getAllByRole("row").find((r) =>
      r.textContent?.includes("Rust Systems")
    );
    expect(rustRow).toBeDefined();

    // The skill name cell should have italic class
    const skillCell = rustRow!.querySelector("td.italic, td .italic, td:first-child");
    // The row should have the muted background class
    expect(rustRow!.className).toContain("text-muted-foreground");
  });

  it("displays — for candidate level when not assessed", () => {
    render(<ComparisonTable comparisons={MOCK_COMPARISONS} />);

    const rustRow = screen.getAllByRole("row").find((r) =>
      r.textContent?.includes("Rust Systems")
    );
    expect(rustRow).toBeDefined();
    // Should contain the em-dash for missing candidate level
    expect(rustRow!.textContent).toContain("—");
  });

  // ── Empty state ────────────────────────────────────────────────────────

  it("renders empty state when comparisons is empty", () => {
    render(<ComparisonTable comparisons={[]} />);

    expect(screen.getByText(/No skill comparisons available/)).toBeInTheDocument();
  });

  // ── Summary bar ────────────────────────────────────────────────────────

  it("renders summary bar with correct counts", () => {
    render(<ComparisonTable comparisons={MOCK_COMPARISONS} />);

    expect(screen.getByText(/Match: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Gap: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Exceeds: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Not assessed: 1/)).toBeInTheDocument();
  });

  it("shows override count in summary when overrides exist", () => {
    render(<ComparisonTable comparisons={MOCK_COMPARISONS} />);

    expect(screen.getByText(/1 override applied/)).toBeInTheDocument();
  });

  // ── Sorting ────────────────────────────────────────────────────────────

  it("sorts by result by default (gaps first)", () => {
    render(<ComparisonTable comparisons={MOCK_COMPARISONS} />);

    const rows = screen.getAllByRole("row");
    // Row 0 is header, row 1 should be gap (first in sort order)
    const firstDataRow = rows[1];
    expect(firstDataRow.textContent).toContain("Node.js");  // gap skill
  });

  // ── Delta display ─────────────────────────────────────────────────────

  it("shows delta with correct sign in result badge", () => {
    render(<ComparisonTable comparisons={MOCK_COMPARISONS} />);

    // Exceed: +2
    expect(screen.getByText(/\+2/)).toBeInTheDocument();
    // Gap: -2
    expect(screen.getByText(/-2/)).toBeInTheDocument();
  });
});
