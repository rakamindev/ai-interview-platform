import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ParticipantTiles from "../ParticipantTiles";

describe("ParticipantTiles - Google Meet White Cards & Static Volume Border", () => {
  it("renders both AI and Candidate conference tiles as white cards with borders", () => {
    const { container } = render(
      <ParticipantTiles
        candidateName="Sarah Connor"
        speaker={null}
        micMuted={false}
      />
    );

    expect(screen.getByText("AI Interviewer (Rakamin)")).toBeInTheDocument();
    expect(screen.getByText("Sarah Connor (You)")).toBeInTheDocument();
    expect(screen.getByText("SC")).toBeInTheDocument();

    const whiteCards = container.querySelectorAll(".bg-white");
    expect(whiteCards.length).toBe(2);

    // Verify both idle tiles have a defined border
    const aiTile = screen.getByTestId("ai-participant-tile");
    const candidateTile = screen.getByTestId("candidate-participant-tile");
    expect(aiTile.style.borderWidth).toBe("1px");
    expect(aiTile.style.borderColor).toBe("rgb(226, 232, 240)");
    expect(candidateTile.style.borderWidth).toBe("1px");
    expect(candidateTile.style.borderColor).toBe("rgb(226, 232, 240)");
  });

  it("applies static bold active border to AI tile when AI is on turn or volume > 15%", () => {
    const mockGetAiVolume = vi.fn().mockReturnValue(0.75);

    render(
      <ParticipantTiles
        candidateName="Sarah Connor"
        speaker="ai"
        micMuted={false}
        getAiVolume={mockGetAiVolume}
      />
    );

    const aiTile = screen.getByTestId("ai-participant-tile");
    expect(aiTile).toBeInTheDocument();
    expect(aiTile.style.borderColor).toBe("rgb(59, 130, 246)"); // #3b82f6
    expect(aiTile.style.borderWidth).toBe("3px");
  });

  it("applies static bold border to Candidate tile when candidate volume is larger than 15", () => {
    const mockGetCandidateVolume = vi.fn().mockReturnValue(0.20); // 20% > 15%

    render(
      <ParticipantTiles
        candidateName="Sarah Connor"
        speaker={null}
        micMuted={false}
        getCandidateVolume={mockGetCandidateVolume}
      />
    );

    const candidateTile = screen.getByTestId("candidate-participant-tile");
    expect(candidateTile).toBeInTheDocument();
    expect(candidateTile.style.borderColor).toBe("rgb(59, 130, 246)");
    expect(candidateTile.style.borderWidth).toBe("3px");
  });

  it("keeps Candidate tile in idle border when volume is 15% or lower", () => {
    const mockGetCandidateVolume = vi.fn().mockReturnValue(0.10); // 10% <= 15%

    render(
      <ParticipantTiles
        candidateName="Sarah Connor"
        speaker={null}
        micMuted={false}
        getCandidateVolume={mockGetCandidateVolume}
      />
    );

    const candidateTile = screen.getByTestId("candidate-participant-tile");
    expect(candidateTile).toBeInTheDocument();
    expect(candidateTile.style.borderColor).toBe("rgb(226, 232, 240)");
    expect(candidateTile.style.borderWidth).toBe("1px");
  });
});
