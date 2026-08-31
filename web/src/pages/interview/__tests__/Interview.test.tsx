import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import userEvent from "@testing-library/user-event";

import { sessionsApi } from "@/services/sessions";
import InterviewPage from "../InterviewPage";
import MOCK_CANDIDATE from "../__mocks__/candidate.mock";
import MockWebSocket from "@/testing/helpers/mockWebSocket";
import {
  mockAudioContext,
  mockGetUserMedia,
} from "@/testing/helpers/mockGetUserMedia";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    audioComplete: vi.fn(),
  },
}));

vi.mock("@/utils/internetSpeedTest", () => ({
  DEFAULT_THRESHOLDS: {
    minDownloadMbps: 8,
    minUploadMbps: 4,
    maxPingMs: 300,
  },
  testInternetSpeed: vi.fn().mockResolvedValue({
    download: 50,
    upload: 20,
    ping: 20,
    passed: true,
    downloadTests: [50],
    uploadTests: [20],
    pingTests: [20],
  }),
}));

describe("Interview Page", () => {
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: MOCK_CANDIDATE,
    } as never);
  });

  beforeEach(() => {
    getUserMedia = mockGetUserMedia();

    vi.stubGlobal("AudioContext", mockAudioContext());
    vi.stubGlobal("webkitAudioContext", mockAudioContext());
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Start Interview", async () => {
    vi.mocked(sessionsApi.audioComplete).mockResolvedValue({
      data: true,
    } as never);

    vi.stubGlobal("WebSocket", MockWebSocket);

    render(
      <MemoryRouter initialEntries={["/interview/secret_token"]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(MOCK_CANDIDATE.role_title),
    ).toBeInTheDocument();
    const inputEmail = await screen.findByLabelText(/email/i);
    await userEvent.type(inputEmail, "user@example.com");
    expect(inputEmail).toHaveValue("user@example.com");

    await waitFor(
      () => {
        expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
      },
      { timeout: 3000 },
    );

    const btnStartInterview = await waitFor(
      () => {
        const button = screen.getByRole("button", {
          name: /start interview/i,
        });
        expect(button).toBeEnabled();
        return button;
      },
      { timeout: 3000 },
    );

    await userEvent.click(btnStartInterview);

    expect(
      await screen.findByText(/Briefly reconnecting — please wait a moment/i),
    ).toBeInTheDocument();
  });
});
