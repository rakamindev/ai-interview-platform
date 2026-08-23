import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import InterviewPage from "@/pages/interview/InterviewPage";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { sessionsApi } from "@/services/sessions";

import * as hardwareUtils from "@/utils/hardwareUtils";

vi.mock("@/services/sessions");

describe("UU PDP Consent", () => {
  it("requires consent checkbox to be true before showing hardware check", async () => {
    vi.spyOn(hardwareUtils, "checkCamera").mockResolvedValue(true as any);
    vi.spyOn(sessionsApi, "getCandidateInfo").mockResolvedValueOnce({
      data: { session_id: 1, role_title: "Developer", time_limit_min: 30, session_status: "pending" },
    } as any);

    render(
      <MemoryRouter initialEntries={["/interview/abc"]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Should ask for consent initially
    await waitFor(() => {
      expect(screen.getByText(/Please accept the privacy consent above/i)).toBeInTheDocument();
    });

    // Find and click the consent checkbox
    const checkbox = screen.getByLabelText(/I consent to voice recording/i);
    expect(checkbox).not.toBeChecked();
    
    fireEvent.click(checkbox);

    // Warning should disappear and hardware check should appear
    await waitFor(() => {
      expect(screen.queryByText(/Please accept the privacy consent above/i)).not.toBeInTheDocument();
      expect(screen.getByText(/OS & browser/i)).toBeInTheDocument(); // HardwareCheck component text
    });
  });
});

