import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VoiceActivityHalo from "../VoiceActivityHalo";

describe("VoiceActivityHalo", () => {
  it("renders idle listening state when speaker is null", () => {
    render(<VoiceActivityHalo speaker={null} />);
    expect(screen.getByText("Listening...")).toBeInTheDocument();
  });

  it("renders AI speaking state with custom label", () => {
    render(<VoiceActivityHalo speaker="ai" label="AI Interviewer Speaking" />);
    expect(screen.getByText("AI Interviewer Speaking")).toBeInTheDocument();
  });

  it("renders candidate speaking state", () => {
    render(<VoiceActivityHalo speaker="candidate" />);
    expect(screen.getByText("You're Speaking")).toBeInTheDocument();
  });
});
