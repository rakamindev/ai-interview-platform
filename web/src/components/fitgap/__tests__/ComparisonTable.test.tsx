import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { contractReport, row } from "@/test/fixtures/fitgap";
import type { SkillComparison } from "@/types";

function renderTable(comparisons: SkillComparison[], busy = false) {
  return render(
    <TooltipProvider delayDuration={0}>
      <ComparisonTable comparisons={comparisons} busy={busy} />
    </TooltipProvider>
  );
}

function rowFor(label: string) {
  return screen.getByText(label).closest<HTMLElement>("[data-testid='comparison-row']")!;
}

describe("ComparisonTable", () => {
  it("renders required and candidate levels for every contract row", () => {
    renderTable(contractReport.skill_comparisons);

    for (const c of contractReport.skill_comparisons) {
      const r = rowFor(c.skill_label);
      expect(within(r).getByTestId("required-level")).toHaveTextContent(`L${c.expected_level}`);
      expect(within(r).getByTestId("candidate-level")).toHaveTextContent(
        c.candidate_level != null ? `L${c.candidate_level}` : "—"
      );
    }
  });

  it("labels outcomes in words with a signed delta", () => {
    renderTable(contractReport.skill_comparisons);

    expect(within(rowFor("React")).getAllByText("Meets")[0]).toBeInTheDocument();
    expect(within(rowFor("Communication")).getAllByText(/Below/)[0]).toHaveTextContent("Below −1");
    expect(within(rowFor("System Design")).getAllByText(/Exceeds/)[0]).toHaveTextContent("Exceeds +2");
  });

  it("marks assessor overrides with the original AI level and shows the note on demand", async () => {
    renderTable(contractReport.skill_comparisons);

    const override = within(rowFor("System Design")).getByRole("button", { name: /Assessor override/ });
    expect(override).toHaveTextContent("AI said L3");

    await userEvent.hover(override);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Designed the payments platform at previous job");
  });

  it("shows AI provenance with confidence for non-overridden rows", () => {
    renderTable(contractReport.skill_comparisons);

    expect(within(rowFor("React")).getByText(/AI rating · high confidence/)).toBeInTheDocument();
  });

  it("flags only low-evidence ratings for verification", () => {
    renderTable(contractReport.skill_comparisons);

    expect(within(rowFor("Communication")).getByText(/Limited evidence — verify/)).toBeInTheDocument();
    expect(within(rowFor("React")).queryByText(/Limited evidence/)).not.toBeInTheDocument();
  });

  it("explains why a skill was not assessed instead of showing a gap", () => {
    renderTable(contractReport.skill_comparisons);

    const r = rowFor("Kubernetes");
    expect(within(r).getByText(/Not covered in the interview — no evidence either way/)).toBeInTheDocument();
    expect(within(r).getAllByText("Not assessed")[0]).toBeInTheDocument();
    expect(within(r).queryByText(/Below/)).not.toBeInTheDocument();
  });

  it("describes the level track for screen readers", () => {
    renderTable([row("Communication")]);

    expect(screen.getByRole("img", { name: "Required L3, candidate L2" })).toBeInTheDocument();
    expect(screen.getByTestId("level-3")).toHaveAttribute("data-required", "true");
    expect(screen.getByTestId("level-2")).toHaveAttribute("data-filled", "true");
    expect(screen.getByTestId("level-3")).not.toHaveAttribute("data-filled");
  });

  it("clamps very long labels but keeps the full text available", () => {
    const label = "Kemampuan Négosiasi & Komunikasi Lintas Fungsi ".repeat(6).trim();
    renderTable([row("React", { skill_label: label })]);

    const el = screen.getByText(label);
    expect(el).toHaveAttribute("title", label);
    expect(el).toHaveClass("line-clamp-2", "break-words");
  });

  it("dims and marks itself busy while a newer version is generating", () => {
    const { container } = renderTable(contractReport.skill_comparisons, true);

    expect(container.querySelector("[aria-busy='true']")).toBeInTheDocument();
  });
});
