import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InterviewPage from "./InterviewPage";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({ sessionsApi: { getCandidateInfo: vi.fn(), audioComplete: vi.fn() } }));
// Device checks and audio are out of scope here; only the screen chosen from the session state matters.
vi.mock("@/components/HardwareCheck", () => ({ default: () => <div>hardware check</div> }));

const info = vi.mocked(sessionsApi.getCandidateInfo);

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/interview/abc"]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const ok = (data: object) => Promise.resolve({ data } as never);

// F13/F19: a candidate must never be told "Interview complete" when the interview failed.
describe("InterviewPage session outcome", () => {
  beforeEach(() => vi.resetAllMocks());

  it("tells a returning candidate their interview ended because of a problem (F19)", async () => {
    info.mockReturnValue(ok({ session_id: 1, role_title: "Backend", time_limit_min: 30, session_status: "ended", end_reason: "error" }));
    renderPage();

    expect(await screen.findByText("The interview could not continue")).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });

  it("still shows completion for an interview that ended normally", async () => {
    info.mockReturnValue(ok({ session_id: 1, role_title: "Backend", time_limit_min: 30, session_status: "ended", end_reason: "all_covered" }));
    renderPage();

    expect(await screen.findByText("Interview Complete")).toBeInTheDocument();
  });

  it("explains an invalid link instead of claiming completion (F13)", async () => {
    info.mockReturnValue(Promise.reject({ response: { status: 404 } }));
    renderPage();

    expect(await screen.findByText(/invalid or has expired/)).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });
});
