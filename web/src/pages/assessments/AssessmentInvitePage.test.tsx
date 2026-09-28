import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentInvitePage from "./AssessmentInvitePage";
import { assessmentsApi } from "@/services/assessments";
vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    getSessions: vi.fn(),
    createSession: vi.fn(),
  },
}));
const sessions = [
  {
    id: 1,
    candidate_name: "Maya",
    status: "pending",
    invite_url: "https://example.test/maya",
  },
  {
    id: 2,
    candidate_name: "Daniel",
    status: "ended",
    portfolio_status: "complete",
    invite_url: "https://example.test/daniel",
  },
];
function setup() {
  render(
    <MemoryRouter initialEntries={["/assessments/1/invite"]}>
      <Routes>
        <Route
          path="/assessments/:id/invite"
          element={<AssessmentInvitePage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(assessmentsApi.get).mockResolvedValue({
    data: {
      assessment: { id: 1, name: "Engineer", time_limit_min: 45, skills: [] },
    },
  } as any);
  vi.mocked(assessmentsApi.getSessions).mockResolvedValue({
    data: { sessions },
  } as any);
});
describe("Candidate workspace", () => {
  it("keeps Copied stable during repeated clipboard writes and ignores overlapping clicks", async () => {
    let resolveCopy!: () => void;
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockImplementationOnce(() => new Promise<void>((resolve) => { resolveCopy = resolve; }));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    setup();
    await screen.findByText("Maya");
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    const copied = await screen.findByRole("button", { name: "Copied" });
    fireEvent.click(copied);
    expect(copied).toHaveTextContent("Copied");
    fireEvent.click(copied);
    expect(writeText).toHaveBeenCalledTimes(2);
    resolveCopy();
    await waitFor(() => expect(copied).toHaveTextContent("Copied"));
  });
  it("filters candidates by review state without changing interview status", async () => {
    setup();
    await screen.findByText("Daniel");
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Filter candidate status" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Needs review" }));
    expect(screen.queryByText("Maya")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).getByText("Completed"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      "/assessments/1/sessions/2/portfolio",
    );
  });
  it("keeps the candidate name on invitation failure, then creates an invitation on retry", async () => {
    vi.mocked(assessmentsApi.createSession)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        data: {
          session: {
            id: 3,
            candidate_name: "Sarah",
            status: "pending",
            invite_url: "https://example.test/sarah",
          },
        },
      } as any);
    setup();
    await screen.findByText("Daniel");
    fireEvent.click(screen.getByRole("button", { name: "Invite candidate" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Candidate name/), {
      target: { value: "Sarah" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create invite link" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Couldn't create",
    );
    expect(within(dialog).getByLabelText(/Candidate name/)).toHaveValue(
      "Sarah",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create invite link" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Candidate invitation link")).toHaveValue(
      "https://example.test/sarah",
    );
    expect(assessmentsApi.createSession).toHaveBeenLastCalledWith(1, "Sarah");
  });
  it("does not claim a clipboard write succeeded when it fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    setup();
    await screen.findByText("Maya");
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't copy");
    expect(
      screen.queryByRole("button", { name: "Copied" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Candidate invitation link")).toHaveValue(
      "https://example.test/maya",
    );
  });
});
