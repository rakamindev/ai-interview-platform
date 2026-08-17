import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import SystemPromptPreview from "./SystemPromptPreview";

const getSystemPromptMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/assessments", () => ({
  assessmentsApi: { getSystemPrompt: getSystemPromptMock },
}));

describe("SystemPromptPreview", () => {
  beforeEach(() => {
    getSystemPromptMock.mockReset();
  });

  it("loads and displays the system prompt inside the dialog", async () => {
    getSystemPromptMock.mockResolvedValue({ data: { system_prompt: "You are an interviewer." } });
    renderWithProviders(<SystemPromptPreview assessmentId={42} />);
    fireEvent.click(screen.getByText("Preview system prompt"));
    await waitFor(() => expect(screen.getByText("You are an interviewer.")).toBeInTheDocument());
    expect(getSystemPromptMock).toHaveBeenCalledWith(42);
  });

  it("surfaces an error with a retry action when loading fails", async () => {
    getSystemPromptMock.mockRejectedValueOnce(new Error("boom"));
    getSystemPromptMock.mockResolvedValueOnce({ data: { system_prompt: "Retried prompt" } });
    renderWithProviders(<SystemPromptPreview assessmentId={1} />);
    fireEvent.click(screen.getByText("Preview system prompt"));
    await waitFor(() =>
      expect(screen.getByText("Failed to load the system prompt.")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(screen.getByText("Retried prompt")).toBeInTheDocument());
  });

  it("does not refetch once the prompt is already loaded", async () => {
    getSystemPromptMock.mockResolvedValue({ data: { system_prompt: "Cached" } });
    renderWithProviders(<SystemPromptPreview assessmentId={2} />);
    fireEvent.click(screen.getByText("Preview system prompt"));
    await waitFor(() => expect(screen.getByText("Cached")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Preview system prompt"));
    expect(getSystemPromptMock).toHaveBeenCalledTimes(1);
  });
});
