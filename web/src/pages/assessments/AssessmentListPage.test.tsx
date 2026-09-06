import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AssessmentListPage from "./AssessmentListPage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: { list: vi.fn(), delete: vi.fn() },
}));

const listMock = assessmentsApi.list as unknown as ReturnType<typeof vi.fn>;
const deleteMock = assessmentsApi.delete as unknown as ReturnType<typeof vi.fn>;

const assessments = [
  {
    id: 1,
    name: "Frontend Assessment",
    time_limit_min: 30,
    language: "en",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 2,
    name: "Backend Assessment",
    time_limit_min: 45,
    language: "en",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments"]}>
      <Routes>
        <Route path="/assessments" element={<AssessmentListPage />} />
        <Route path="/assessments/:id/invite" element={<div>Invite page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AssessmentListPage delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue({ data: { assessments } });
    deleteMock.mockResolvedValue({ data: { message: "Assessment deleted" } });
  });

  it("shows a delete button per assessment", async () => {
    renderPage();

    expect(await screen.findByText("Frontend Assessment")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Frontend Assessment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Backend Assessment" })).toBeInTheDocument();
  });

  it("cancelling the confirmation does not delete", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete Frontend Assessment" }));
    expect(await screen.findByText("Delete assessment?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getByText("Frontend Assessment")).toBeInTheDocument();
  });

  it("deletes an assessment and removes it from the list", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete Frontend Assessment" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await screen.findByText("Backend Assessment");
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith(1);
    expect(screen.queryByText("Frontend Assessment")).not.toBeInTheDocument();
  });

  it("shows the backend error and keeps the assessment when deletion fails", async () => {
    deleteMock.mockRejectedValue({
      response: {
        data: {
          errors: [{ message: "Cannot delete record because dependent sessions exist" }],
        },
      },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete Backend Assessment" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("Cannot delete record because dependent sessions exist")
    ).toBeInTheDocument();
    expect(screen.getByText("Backend Assessment")).toBeInTheDocument();
  });
});