import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MyDataDialog from "@/components/interview/MyDataDialog";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getMyData: vi.fn(),
    deleteMyData: vi.fn(),
  },
}));

const getMyDataMock = vi.mocked(sessionsApi.getMyData);
const deleteMyDataMock = vi.mocked(sessionsApi.deleteMyData);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MyDataDialog", () => {
  it("shows the candidate's name and transcript when loaded", async () => {
    getMyDataMock.mockResolvedValue({
      data: {
        candidate_name: "Budi Santoso",
        data_purged: false,
        transcript: [{ speaker: "candidate", text: "Hello there" }],
        verdict: "pass",
        skills: [],
      },
    } as any);

    render(<MyDataDialog token="abc" open onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText(/Hello there/)).toBeInTheDocument();
  });

  it("shows a distinct failure message when transcript capture failed, not a generic empty state", async () => {
    getMyDataMock.mockResolvedValue({
      data: {
        candidate_name: "Budi Santoso",
        data_purged: false,
        transcript: [],
        transcript_capture_failed: true,
        verdict: null,
        skills: [],
      },
    } as any);

    render(<MyDataDialog token="abc" open onOpenChange={vi.fn()} />);

    expect(await screen.findByText(/Recording failed during this interview/)).toBeInTheDocument();
    expect(screen.queryByText("No transcript recorded.")).not.toBeInTheDocument();
  });

  it("shows an error message when the fetch fails", async () => {
    getMyDataMock.mockRejectedValue(new Error("network down"));

    render(<MyDataDialog token="abc" open onOpenChange={vi.fn()} />);

    expect(await screen.findByText(/Couldn't load your data/)).toBeInTheDocument();
  });

  it("deletes the data after confirming and reflects the purged state", async () => {
    getMyDataMock.mockResolvedValue({
      data: {
        candidate_name: "Budi Santoso",
        data_purged: false,
        transcript: [],
        verdict: null,
        skills: [],
      },
    } as any);
    deleteMyDataMock.mockResolvedValue({ data: { deleted: true } } as any);

    render(<MyDataDialog token="abc" open onOpenChange={vi.fn()} />);
    await screen.findByText("Budi Santoso");

    fireEvent.click(screen.getByRole("button", { name: "Delete my data" }));
    const confirmButtons = screen.getAllByRole("button", { name: "Delete my data" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(deleteMyDataMock).toHaveBeenCalledWith("abc"));
    expect(await screen.findByText(/Your personal data has been deleted/)).toBeInTheDocument();
  });

  it("does not fetch data when closed", () => {
    render(<MyDataDialog token="abc" open={false} onOpenChange={vi.fn()} />);

    expect(getMyDataMock).not.toHaveBeenCalled();
  });
});
