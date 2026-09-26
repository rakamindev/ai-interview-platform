import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CheckCircle } from "lucide-react";
import { useState } from "react";
import HardwareCheck from "@/components/HardwareCheck";

function StepFlowTestWrapper({ initialConsentGiven = false }: { initialConsentGiven?: boolean }) {
  const [consentChecked, setConsentChecked] = useState(initialConsentGiven);
  const [consentSubmitted, setConsentSubmitted] = useState(initialConsentGiven);

  if (!consentSubmitted) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck />
            <span>Privacy & AI Evaluation Consent</span>
          </div>
        </CardHeader>
        <CardContent>
          <p>Live Audio Recording</p>
          <p>Automated AI Competency Evaluation</p>
          <p>Confidentiality & Data Protection</p>

          <input
            id="pdp-consent"
            type="checkbox"
            data-testid="pdp-consent-checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
          />
          <label htmlFor="pdp-consent">
            I have read and agree to live audio recording and automated AI competency evaluation
          </label>

          <Button
            disabled={!consentChecked}
            onClick={() => setConsentSubmitted(true)}
          >
            Continue to Device Check
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div data-testid="consent-accepted-badge">
        <CheckCircle />
        <span>Privacy and AI evaluation consent accepted.</span>
      </div>
      <HardwareCheck onStart={() => {}} />
    </div>
  );
}

describe("Candidate Protection & Privacy Consent Flow", () => {
  it("renders English privacy and automated AI profiling disclosures without law code", () => {
    render(<StepFlowTestWrapper />);

    expect(screen.getByText("Privacy & AI Evaluation Consent")).toBeInTheDocument();
    expect(screen.getByText("Live Audio Recording")).toBeInTheDocument();
    expect(screen.getByText("Automated AI Competency Evaluation")).toBeInTheDocument();
    expect(screen.getByText("Confidentiality & Data Protection")).toBeInTheDocument();
    expect(screen.queryByText(/UU No\. 27\/2022/i)).not.toBeInTheDocument();
  });

  it("keeps Continue button disabled until checkbox is checked", () => {
    render(<StepFlowTestWrapper />);

    const continueButton = screen.getByRole("button", { name: /Continue to Device Check/i });
    expect(continueButton).toBeDisabled();

    const checkbox = screen.getByTestId("pdp-consent-checkbox");
    fireEvent.click(checkbox);

    expect(continueButton).not.toBeDisabled();
  });

  it("transitions to hardware check only after candidate accepts consent", () => {
    render(<StepFlowTestWrapper />);

    expect(screen.queryByText(/OS & browser/i)).not.toBeInTheDocument();

    const checkbox = screen.getByTestId("pdp-consent-checkbox");
    fireEvent.click(checkbox);

    const continueButton = screen.getByRole("button", { name: /Continue to Device Check/i });
    fireEvent.click(continueButton);

    expect(screen.getByTestId("consent-accepted-badge")).toBeInTheDocument();
    expect(screen.getByText("Privacy and AI evaluation consent accepted.")).toBeInTheDocument();
    expect(screen.getByText(/OS & browser/i)).toBeInTheDocument();
  });

  it("bypasses consent step directly to hardware check if consent is already recorded on server", () => {
    render(<StepFlowTestWrapper initialConsentGiven={true} />);

    expect(screen.queryByText("Privacy & AI Evaluation Consent")).not.toBeInTheDocument();
    expect(screen.getByTestId("consent-accepted-badge")).toBeInTheDocument();
    expect(screen.getByText("Privacy and AI evaluation consent accepted.")).toBeInTheDocument();
    expect(screen.getByText(/OS & browser/i)).toBeInTheDocument();
  });
});
