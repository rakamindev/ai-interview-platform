import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import VoiceBars from "@/components/interview/VoiceBars";

describe("VoiceBars (Gated Audio-Reactive Visualizer)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders with .animate-voice-bar fallback when active without an AnalyserNode", () => {
    const { container } = render(
      <VoiceBars active={true} label="AI speaking" variant="ai" />
    );

    expect(screen.getByText("AI speaking")).toBeInTheDocument();
    const activeBars = container.querySelectorAll(".animate-voice-bar");
    expect(activeBars.length).toBe(5);
  });

  it("renders idle bars without .animate-voice-bar when active is false", () => {
    const { container } = render(
      <VoiceBars active={false} label="Listening..." variant="ai" />
    );

    expect(screen.getByText("Listening...")).toBeInTheDocument();
    const activeBars = container.querySelectorAll(".animate-voice-bar");
    expect(activeBars.length).toBe(0);
  });

  it("connects to AnalyserNode via requestAnimationFrame and applies dynamic transforms", () => {
    let rafCallback: FrameRequestCallback | null = null;
    const requestSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        rafCallback = cb;
        return 123;
      });
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const mockGetByteFrequencyData = vi.fn((array: Uint8Array) => {
      // Simulate speech audio level (average ~120 out of 255)
      array.fill(120);
    });

    const mockAnalyser = {
      frequencyBinCount: 64,
      getByteFrequencyData: mockGetByteFrequencyData,
    } as unknown as AnalyserNode;

    const { container, unmount } = render(
      <VoiceBars
        active={true}
        label="You're speaking"
        variant="candidate"
        analyserNode={mockAnalyser}
      />
    );

    expect(requestSpy).toHaveBeenCalled();
    expect(rafCallback).toBeDefined();

    // Trigger one animation frame
    if (rafCallback) {
      (rafCallback as FrameRequestCallback)(1000);
    }

    expect(mockGetByteFrequencyData).toHaveBeenCalled();

    // Verify bars have transform styles applied dynamically
    const bars = container.querySelectorAll("[data-voice-bar]");
    expect(bars.length).toBe(5);
    bars.forEach((bar) => {
      const el = bar as HTMLElement;
      expect(el.style.transform).toMatch(/scaleY\([0-9.]+\)/);
    });

    // Unmounting should cancel the animation frame
    unmount();
    expect(cancelSpy).toHaveBeenCalledWith(123);
  });

  it("resets bar transforms when active becomes false with an AnalyserNode", () => {
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(456);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const mockAnalyser = {
      frequencyBinCount: 64,
      getByteFrequencyData: vi.fn(),
    } as unknown as AnalyserNode;

    const { container, rerender } = render(
      <VoiceBars
        active={true}
        label="AI speaking"
        analyserNode={mockAnalyser}
      />
    );

    // Change active to false
    rerender(
      <VoiceBars
        active={false}
        label="Listening..."
        analyserNode={mockAnalyser}
      />
    );

    const bars = container.querySelectorAll("[data-voice-bar]");
    bars.forEach((bar) => {
      const el = bar as HTMLElement;
      expect(el.style.transform).toBe("scaleY(1)");
    });
  });
});
