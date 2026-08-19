import { describe, it, expect } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import VoiceBars from "./VoiceBars";

describe("VoiceBars", () => {
  it("renders five bars and the label", () => {
    const { container } = render(<VoiceBars active={false} label="AI is listening" />);
    expect(screen.getByText("AI is listening")).toBeInTheDocument();
    const bars = container.querySelectorAll(".h-10 > div");
    expect(bars.length).toBe(5);
  });

  it("renders inactive bars with low opacity", () => {
    const { container } = render(<VoiceBars active={false} label="x" />);
    const bar = container.querySelector(".h-10 > div");
    expect(bar?.className).toContain("opacity-30");
    expect(bar?.className).toContain("h-1");
    expect(bar).not.toHaveStyle({ animationDelay: expect.anything() });
  });

  it("animates active bars and delays each one", () => {
    const { container } = render(<VoiceBars active={true} label="x" />);
    const bars = container.querySelectorAll(".h-10 > div");
    expect(bars[0].className).toContain("animate-voice-bar");
    expect(bars[0]).toHaveStyle({ animationDelay: "0s" });
    expect(bars[1]).toHaveStyle({ animationDelay: "0.1s" });
  });

  it("uses the variant color class", () => {
    const { container } = render(<VoiceBars active={true} label="x" variant="candidate" />);
    const bar = container.querySelector(".h-10 > div");
    expect(bar?.className).toContain("bg-secondary");
  });
});
