import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NarrativeCards from "./NarrativeCards";

describe("NarrativeCards", () => {
  it("menampilkan label AI untuk narasi yang dibuat model", () => {
    render(
      <NarrativeCards
        culture_narrative="Narasi budaya dari model."
        overall_narrative="Penilaian keseluruhan dari model."
        narrative_source="ai"
      />,
    );

    expect(screen.getAllByText("AI-generated")).toHaveLength(2);
    expect(screen.queryByText("Rule-based fallback")).not.toBeInTheDocument();
  });

  it("menjelaskan fallback dan tidak mengklaimnya sebagai narasi AI", () => {
    render(
      <NarrativeCards
        culture_narrative=""
        overall_narrative="Candidate shows 1 skill matches."
        narrative_source="rule_based_fallback"
      />,
    );

    expect(screen.getByText("Rule-based fallback")).toBeInTheDocument();
    expect(screen.getByText(/AI narrative was unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText("AI-generated")).not.toBeInTheDocument();
  });
});
