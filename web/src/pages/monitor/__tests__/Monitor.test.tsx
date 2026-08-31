import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import userEvent from "@testing-library/user-event";

import { sessionsApi } from "@/services/sessions";
import MockWebSocket from "@/testing/helpers/mockWebSocket";
import {
  mockAudioContext,
  mockGetUserMedia,
} from "@/testing/helpers/mockGetUserMedia";
import LiveMonitorPage from "../LiveMonitorPage";
import MOCK_ACTIVE_SESSION from "../__mocks__/activeSession.mock";
import MOCK_TRANSCRIPT, {
  MOCK_EMPTY_TRANSCRIPT,
} from "../__mocks__/transcript.mock";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    get: vi.fn(),
    getTranscript: vi.fn(),
  },
}));

describe("Monitor Session Page", () => {
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: MOCK_ACTIVE_SESSION },
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

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={["/assessments/1/sessions/14/monitor"]}>
        <Routes>
          <Route
            path="/assessments/:id/sessions/:sessionId/monitor"
            element={<LiveMonitorPage />}
          />
          <Route
            path="/assessments/:id/sessions/:sessionId/portfolio"
            element={<>Dummy Portfolio</>}
          />
          <Route path="/assessments/:id/invite" element={<>Dummy Invite</>} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it("Session with transcript", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.mocked(sessionsApi.getTranscript).mockResolvedValue({
      data: MOCK_TRANSCRIPT,
    } as never);

    renderComponent();

    expect(
      await screen.findByText(MOCK_ACTIVE_SESSION.assessment.name),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /view portfolio/i }),
    );
    expect(await screen.findByText(/dummy portfolio/i)).toBeInTheDocument();
  });

  it("Session empty transcript", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);

    vi.mocked(sessionsApi.getTranscript).mockResolvedValue({
      data: MOCK_EMPTY_TRANSCRIPT,
    } as never);

    renderComponent();

    expect(
      await screen.findByText(MOCK_ACTIVE_SESSION.assessment.name),
    ).toBeInTheDocument();

    expect(await screen.findByText(/No transcript yet/i)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("btn-back"));
    expect(await screen.findByText(/dummy invite/i)).toBeInTheDocument();
  });
});
