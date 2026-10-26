import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NarrativeCard from "@/components/fitgap/NarrativeCard";

describe("NarrativeCard", () => {
  it("labels AI text as a draft to verify", () => {
    render(<NarrativeCard report={{ narrative_source: "ai", overall_narrative: "Probe async work.", culture_narrative: "Ownership." }} />);

    expect(screen.getByText("AI-generated draft")).toBeInTheDocument();
    expect(screen.getByText(/Verify before using it in a hiring decision/)).toBeInTheDocument();
    expect(screen.getByText("Overall")).toBeInTheDocument();
    expect(screen.getByText("Culture & competency")).toBeInTheDocument();
  });

  it("labels the deterministic fallback honestly", () => {
    render(<NarrativeCard report={{ narrative_source: "fallback", overall_narrative: "Of 4 required skills…", culture_narrative: null }} />);

    expect(screen.getByText("Automatic summary")).toBeInTheDocument();
    expect(screen.getByText(/AI narrative was unavailable/)).toBeInTheDocument();
    expect(screen.queryByText("Culture & competency")).not.toBeInTheDocument();
  });

  it("shows both paragraphs instead of hiding one behind the other", () => {
    render(<NarrativeCard report={{ narrative_source: "ai", overall_narrative: "Overall text", culture_narrative: "Culture text" }} />);

    expect(screen.getByText("Overall text")).toBeInTheDocument();
    expect(screen.getByText("Culture text")).toBeInTheDocument();
  });

  it("collapses long narratives behind Read more", async () => {
    render(<NarrativeCard report={{ narrative_source: "ai", overall_narrative: "word ".repeat(200), culture_narrative: null }} />);

    await userEvent.click(screen.getByRole("button", { name: "Read more" }));
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
  });

  it("renders nothing when there is no narrative", () => {
    const { container } = render(
      <NarrativeCard report={{ narrative_source: null, overall_narrative: "  ", culture_narrative: null }} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
