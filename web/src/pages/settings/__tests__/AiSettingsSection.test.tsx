import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AiSettingsSection from "../AiSettingsSection";
import { organizationService } from "@/services/organization";

vi.mock("@/services/organization", () => ({
  organizationService: {
    getAiConfig: vi.fn(),
    updateAiConfig: vi.fn(),
  },
}));

describe("AiSettingsSection", () => {
  const mockConfig = {
    custom_ai_configured: true,
    gemini_api_key_configured: true,
    masked_gemini_api_key: "AIzaSy...7890",
    models: {
      live: "gemini-2.0-flash-exp",
      flash: "gemini-2.0-flash",
      pro: "gemini-2.0-pro-exp-02-05",
    },
    voice: "Puck",
    temperature: 0.2,
    allowed_voices: ["Puck", "Charon", "Aoede", "Fenrir", "Kore"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays organization AI configuration", async () => {
    vi.mocked(organizationService.getAiConfig).mockResolvedValue(mockConfig);

    render(<AiSettingsSection />);

    expect(screen.getByText("Loading AI configuration...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Enterprise AI Engine Configuration")).toBeInTheDocument();
    });

    expect(screen.getByText(/Custom Key Active: AIzaSy\.\.\.7890/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("gemini-2.0-flash-exp")).toBeInTheDocument();
    expect(screen.getByDisplayValue("gemini-2.0-pro-exp-02-05")).toBeInTheDocument();
  });

  it("submits updated AI parameters and displays success message", async () => {
    vi.mocked(organizationService.getAiConfig).mockResolvedValue(mockConfig);
    vi.mocked(organizationService.updateAiConfig).mockResolvedValue({
      ...mockConfig,
      voice: "Fenrir",
      temperature: 0.4,
    });

    render(<AiSettingsSection />);

    await waitFor(() => {
      expect(screen.getByText("Enterprise AI Engine Configuration")).toBeInTheDocument();
    });

    const voiceSelect = screen.getByLabelText("Interviewer Voice Profile");
    fireEvent.change(voiceSelect, { target: { value: "Fenrir" } });

    const tempInput = screen.getByLabelText("Sampling Temperature (0.0 – 1.0)");
    fireEvent.change(tempInput, { target: { value: "0.4" } });

    const saveBtn = screen.getByRole("button", { name: /Save AI Settings/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(organizationService.updateAiConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: "Fenrir",
          temperature: 0.4,
        })
      );
      expect(screen.getByText("AI settings saved successfully.")).toBeInTheDocument();
    });
  });
});
