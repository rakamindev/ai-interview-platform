import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import HeroBanner from "@/components/common/HeroBanner";
import RakaminSpinner from "@/components/common/RakaminSpinner";

describe("HeroBanner component", () => {
  it("renders title, highlightText, subtitle and bullet points", () => {
    render(
      <HeroBanner
        badgeText="Test Badge"
        title="Evaluasi Talenta"
        highlightText="AI Cepat"
        subtitle="Platform evaluasi talenta nomor satu"
        bulletPoints={["Fitur A", "Fitur B"]}
        imageSrc="/images/hero-rakamin-logo.png"
      />
    );

    expect(screen.getByText("Test Badge")).toBeInTheDocument();
    expect(screen.getByText(/Evaluasi Talenta/)).toBeInTheDocument();
    expect(screen.getByText("AI Cepat")).toBeInTheDocument();
    expect(screen.getByText("Platform evaluasi talenta nomor satu")).toBeInTheDocument();
    expect(screen.getByText("Fitur A")).toBeInTheDocument();
    expect(screen.getByText("Fitur B")).toBeInTheDocument();
  });

  it("renders primary and secondary CTA buttons when provided", () => {
    render(
      <HeroBanner
        title="Title"
        subtitle="Subtitle"
        primaryAction={{ label: "Action 1", onClick: () => {} }}
        secondaryAction={{ label: "Action 2", onClick: () => {} }}
      />
    );

    expect(screen.getByText("Action 1")).toBeInTheDocument();
    expect(screen.getByText("Action 2")).toBeInTheDocument();
  });
});

describe("RakaminSpinner component", () => {
  it("renders spinner text and pulse elements", () => {
    render(<RakaminSpinner text="Memuat data asesmen..." />);
    expect(screen.getByText("Memuat data asesmen...")).toBeInTheDocument();
    expect(screen.getByText("</>")).toBeInTheDocument();
  });
});
