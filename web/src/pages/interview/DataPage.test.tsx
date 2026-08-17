import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import DataPage from "@/pages/interview/DataPage";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateTranscript: vi.fn(),
    deleteCandidateData: vi.fn(),
  },
}));

const getTranscriptMock = vi.mocked(sessionsApi.getCandidateTranscript);
const deleteDataMock = vi.mocked(sessionsApi.deleteCandidateData);

const turns = [
  {
    id: 1,
    turn_number: 1,
    speaker: "ai",
    text: "Tell me about yourself.",
    created_at: "2026-08-17T00:00:00Z",
  },
];

function renderDataPage() {
  return render(
    <MemoryRouter initialEntries={["/interview/tk/data"]}>
      <Routes>
        <Route path="/interview/:token/data" element={<DataPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("DataPage (AC-F3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTranscriptMock.mockResolvedValue({ data: { turns, total: 1 } } as never);
  });

  it("shows the candidate's transcript", async () => {
    renderDataPage();

    expect(
      await screen.findByText(/Tell me about yourself/i)
    ).toBeInTheDocument();
    expect(getTranscriptMock).toHaveBeenCalledWith("tk");
  });

  it("deletes all data after confirming and shows a success state", async () => {
    const user = userEvent.setup();
    deleteDataMock.mockResolvedValue({
      data: { status: "ok", message: "deleted" },
    } as never);

    renderDataPage();
    await screen.findByText(/Tell me about yourself/i);

    await user.click(screen.getByRole("button", { name: /delete my data/i }));

    const dialog = screen.getByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: /delete my data/i })
    );

    await waitFor(() => expect(deleteDataMock).toHaveBeenCalledWith("tk"));
    expect(
      await screen.findByText(/Your data has been deleted/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No further action is needed/i)
    ).toBeInTheDocument();
  });

  it("shows an inline error when deletion fails", async () => {
    const user = userEvent.setup();
    deleteDataMock.mockRejectedValue(new Error("boom"));

    renderDataPage();
    await screen.findByText(/Tell me about yourself/i);

    await user.click(screen.getByRole("button", { name: /delete my data/i }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /delete my data/i,
      })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Deletion failed. Please try again/i
    );
    expect(
      screen.queryByText(/Your data has been deleted/i)
    ).not.toBeInTheDocument();
  });
});
