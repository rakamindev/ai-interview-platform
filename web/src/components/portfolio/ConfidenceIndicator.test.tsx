import { render, screen } from "@testing-library/react";
import ConfidenceIndicator, { ConfidenceCaveat, normalizeConfidence } from "./ConfidenceIndicator";

// AC-4 and AC-5. This component decides how much weight a reader gives a level
// about a real person, so the rule that matters most is which way it rounds
// when it does not know.
describe("normalizeConfidence", () => {
  it("reads the three known values", () => {
    expect(normalizeConfidence("high")).toBe("high");
    expect(normalizeConfidence("medium")).toBe("medium");
    expect(normalizeConfidence("low")).toBe("low");
  });

  it("ignores casing, because the API is not the only caller", () => {
    expect(normalizeConfidence("HIGH")).toBe("high");
    expect(normalizeConfidence("Medium")).toBe("medium");
  });

  // Guessing upward would overstate certainty about someone's competence. When
  // the value is missing or unrecognised the honest reading is the weakest one.
  it.each([undefined, null, "", "unknown", "confirmed", "very high"])(
    "falls back to low rather than up for %p",
    (value) => {
      expect(normalizeConfidence(value as string | null | undefined)).toBe("low");
    }
  );
});

describe("<ConfidenceIndicator />", () => {
  it("names the confidence rather than leaving it to a colour", () => {
    render(<ConfidenceIndicator confidence="high" />);
    expect(screen.getByText("High confidence")).toBeInTheDocument();
  });

  it("shows what the claim rests on", () => {
    render(<ConfidenceIndicator confidence="medium" evidenceCount={3} />);
    expect(screen.getByText("· 3 quotes")).toBeInTheDocument();
  });

  it("says one quote in the singular", () => {
    render(<ConfidenceIndicator confidence="low" evidenceCount={1} />);
    expect(screen.getByText("· 1 quote")).toBeInTheDocument();
  });

  it("omits the count when there is nothing to report", () => {
    render(<ConfidenceIndicator confidence="high" />);
    expect(screen.queryByText(/quote/)).not.toBeInTheDocument();
  });

  it("treats an unrecognised value as low", () => {
    render(<ConfidenceIndicator confidence="definitely" />);
    expect(screen.getByText("Low confidence")).toBeInTheDocument();
  });
});

describe("<ConfidenceCaveat />", () => {
  // The caveat has to tell the reader what to do, not merely that the number is
  // soft. "Low confidence" is a label; "do not screen anyone out on this" is an
  // instruction, and the people who most need it are the ones skimming.
  it("tells the reader not to act on a low-confidence level", () => {
    render(<ConfidenceCaveat confidence="low" />);
    expect(screen.getByText(/do not use this level to screen anyone out/i)).toBeInTheDocument();
  });

  it("asks for a human interview at medium", () => {
    render(<ConfidenceCaveat confidence="medium" />);
    expect(screen.getByText(/worth confirming in a human interview/i)).toBeInTheDocument();
  });

  it("stays silent when the rating is well evidenced", () => {
    const { container } = render(<ConfidenceCaveat confidence="high" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("warns rather than staying silent when confidence is missing", () => {
    const { container } = render(<ConfidenceCaveat confidence={undefined} />);
    expect(container).not.toBeEmptyDOMElement();
  });
});
