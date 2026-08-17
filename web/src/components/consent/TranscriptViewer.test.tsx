import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TranscriptViewer from "@/components/consent/TranscriptViewer";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getCandidateTranscript: vi.fn() },
}));

const getTranscriptMock = vi.mocked(sessionsApi.getCandidateTranscript);

const turns = [
  {
    id: 1,
    turn_number: 1,
    speaker: "ai",
    text: "Tell me about yourself.",
    created_at: "2026-08-17T00:00:00Z",
  },
  {
    id: 2,
    turn_number: 2,
    speaker: "candidate",
    text: "I build things.",
    created_at: "2026-08-17T00:01:00Z",
  },
];

describe("TranscriptViewer (AC-F4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while the transcript is being fetched", async () => {
    let resolveFetch!: (v: never) => void;
    getTranscriptMock.mockImplementation(
      () =>
        new Promise((res) => {
          resolveFetch = res;
        })
    );

    render(<TranscriptViewer token="tk" />);

    expect(
      screen.queryByText(/Tell me about yourself/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /copy all/i })
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch({ data: { turns, total: 2 } } as never);
    });

    expect(
      await screen.findByText(/Tell me about yourself/i)
    ).toBeInTheDocument();
  });

  it("renders every turn with a read-only count", async () => {
    getTranscriptMock.mockResolvedValue({ data: { turns, total: 2 } } as never);

    render(<TranscriptViewer token="tk" />);

    expect(
      await screen.findByText(/Tell me about yourself/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/I build things/i)).toBeInTheDocument();
    expect(screen.getByText(/2 messages · read-only/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy all/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download/i })
    ).toBeInTheDocument();
  });

  it("shows an empty state when there is no transcript yet", async () => {
    getTranscriptMock.mockResolvedValue({
      data: { turns: [], total: 0 },
    } as never);

    render(<TranscriptViewer token="tk" />);

    expect(
      await screen.findByText(
        /No transcript is available for this interview yet/i
      )
    ).toBeInTheDocument();
  });

  it("shows an inline error and retries successfully", async () => {
    const user = userEvent.setup();
    getTranscriptMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({ data: { turns, total: 2 } } as never);

    render(<TranscriptViewer token="tk" />);

    expect(
      await screen.findByText(/Couldn't load the transcript/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() =>
      expect(screen.getByText(/Tell me about yourself/i)).toBeInTheDocument()
    );
    expect(getTranscriptMock).toHaveBeenCalledTimes(2);
  });

  it("maps a 403 to the consent-required message", async () => {
    getTranscriptMock.mockRejectedValue({
      response: { status: 403 },
    } as never);

    render(<TranscriptViewer token="tk" />);

    expect(
      await screen.findByText(/Consent required to view the transcript/i)
    ).toBeInTheDocument();
  });
});
