import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import AudioDecibelMeter from "../AudioDecibelMeter";
import SpeakerStatePill from "../SpeakerStatePill";
import NetworkHealthPill from "../NetworkHealthPill";

describe("Interview UI Atoms", () => {
  describe("AudioDecibelMeter", () => {
    it("renders with 5 discrete bars", () => {
      render(<AudioDecibelMeter level={50} label="Mic input" />);
      expect(screen.getByText("Mic input")).toBeInTheDocument();
      const bars = [0, 1, 2, 3, 4].map((i) => screen.getByTestId(`meter-bar-${i}`));
      expect(bars).toHaveLength(5);
      // Level 50 is >= 5, 25, 45, but not 65 or 85
      expect(bars[0]).toHaveClass("bg-emerald-500");
      expect(bars[1]).toHaveClass("bg-emerald-500");
      expect(bars[2]).toHaveClass("bg-emerald-500");
      expect(bars[3]).toHaveClass("bg-neutral-200");
      expect(bars[4]).toHaveClass("bg-neutral-200");
    });

    it("clamps level to 0-100", () => {
      render(<AudioDecibelMeter level={150} />);
      const meter = screen.getByRole("meter");
      expect(meter).toHaveAttribute("aria-valuenow", "100");
    });
  });

  describe("SpeakerStatePill", () => {
    it("renders AI speaking state", () => {
      render(<SpeakerStatePill state="ai" />);
      expect(screen.getByText("AI Speaking")).toBeInTheDocument();
      expect(screen.getByTestId("speaker-state-ai")).toBeInTheDocument();
    });

    it("renders candidate listening state", () => {
      render(<SpeakerStatePill state="candidate" />);
      expect(screen.getByText("Listening... Your turn")).toBeInTheDocument();
      expect(screen.getByTestId("speaker-state-candidate")).toBeInTheDocument();
    });

    it("renders processing state", () => {
      render(<SpeakerStatePill state="processing" />);
      expect(screen.getByText("Processing...")).toBeInTheDocument();
    });

    it("renders idle state", () => {
      render(<SpeakerStatePill state="idle" />);
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });
  });

  describe("NetworkHealthPill", () => {
    it("renders connected state", () => {
      render(<NetworkHealthPill state="connected" />);
      expect(screen.getByText("Connected • Stable")).toBeInTheDocument();
    });

    it("renders reconnecting state with countdown", () => {
      render(<NetworkHealthPill state="reconnecting" countdownSeconds={5} />);
      expect(screen.getByText("Reconnecting... (5s)")).toBeInTheDocument();
    });

    it("renders offline state", () => {
      render(<NetworkHealthPill state="offline" />);
      expect(screen.getByText("Offline")).toBeInTheDocument();
    });
  });
});
