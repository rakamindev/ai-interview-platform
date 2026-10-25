import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentListPage from "@/pages/assessments/AssessmentListPage";
import { assessmentsApi } from "@/services/assessments";
import { renderWithQueryClient } from "@/test/renderWithQueryClient";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: { list: vi.fn() },
}));

const listMock = assessmentsApi.list as ReturnType<typeof vi.fn>;

const assessment = (id: number, name = `Assessment ${id}`) => ({
  id,
  name,
  time_limit_min: 30,
});

const response = (page: number, items = [assessment(page)]) => ({
  data: {
    assessments: items,
    meta: { current_page: page, total_pages: 3, total_count: 45, per_page: 20 },
  },
});

function LocationState() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="Current location">{location.pathname + location.search}</output>
      <button onClick={() => navigate(-1)}>Browser back</button>
    </>
  );
}

function renderPage(entry = "/assessments") {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/assessments"
          element={
            <>
              <AssessmentListPage />
              <LocationState />
            </>
          }
        />
        <Route path="/assessments/:id/invite" element={<p>Invite destination</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  listMock.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

describe("AssessmentListPage", () => {
  it("loads the URL page and renders semantic card links with pagination metadata", async () => {
    listMock.mockResolvedValue(response(2, [assessment(22, "A very long assessment name")]));
    renderPage("/assessments?page=2");

    const cardLink = await screen.findByRole("link", { name: /a very long assessment name/i });
    expect(listMock).toHaveBeenCalledWith({ page: 2 });
    expect(cardLink).toHaveAttribute("href", "/assessments/22/invite");
    expect(cardLink.querySelector("p")).toHaveClass("truncate");
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.tagName === "P" && element.textContent === "Showing 21–40 of 45 records"
      )
    ).toBeInTheDocument();
  });

  it("updates the URL and disables controls while the next page loads", async () => {
    let resolveSecondPage!: (value: ReturnType<typeof response>) => void;
    listMock
      .mockResolvedValueOnce(response(1))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecondPage = resolve; }));
    renderPage();

    const user = userEvent.setup();
    await screen.findByText("Assessment 1");
    await user.click(screen.getByRole("button", { name: /next page/i }));

    expect(screen.getByLabelText("Current location")).toHaveTextContent("/assessments?page=2");
    expect(screen.getByText("Assessment 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();

    resolveSecondPage(response(2, [assessment(2)]));
    expect(await screen.findByText("Assessment 2")).toBeInTheDocument();
    expect(screen.getByLabelText(/assessment results, page 2/i)).toHaveFocus();
  });

  it("normalizes invalid and out-of-range page values", async () => {
    listMock
      .mockResolvedValueOnce(response(1))
      .mockResolvedValueOnce({
        data: {
          assessments: [],
          meta: { current_page: 8, total_pages: 3, total_count: 45, per_page: 20 },
        },
      })
      .mockResolvedValueOnce(response(3, [assessment(45)]));

    const invalidView = renderPage("/assessments?page=-2.5");
    expect(await screen.findByText("Assessment 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/assessments?page=1");
    invalidView.unmount();

    renderPage("/assessments?page=8");
    expect(await screen.findByText("Assessment 45")).toBeInTheDocument();
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/assessments?page=3");
    expect(listMock).toHaveBeenLastCalledWith({ page: 3 });
  });

  it("ignores a stale response after browser navigation", async () => {
    let resolvePageTwo!: (value: ReturnType<typeof response>) => void;
    listMock
      .mockResolvedValueOnce(response(1, [assessment(1, "First page")]))
      .mockImplementationOnce(() => new Promise((resolve) => { resolvePageTwo = resolve; }))
      .mockResolvedValueOnce(response(1, [assessment(1, "First page restored")]));
    renderPage();

    const user = userEvent.setup();
    await screen.findByText("First page");
    await user.click(screen.getByRole("button", { name: /next page/i }));
    await user.click(screen.getByRole("button", { name: /browser back/i }));
    expect(await screen.findByText("First page restored")).toBeInTheDocument();

    resolvePageTwo(response(2, [assessment(2, "Stale second page")]));
    await waitFor(() => expect(screen.queryByText("Stale second page")).not.toBeInTheDocument());
  });

  it("shows an exclusive retry state and retries the selected page", async () => {
    listMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(response(2, [assessment(21)]));
    renderPage("/assessments?page=2");

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load assessments");
    expect(screen.queryByText(/no assessments yet/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Assessment 21")).toBeInTheDocument();
    expect(listMock).toHaveBeenLastCalledWith({ page: 2 });
  });

  it("retains the creation CTA for a genuinely empty first page", async () => {
    listMock.mockResolvedValue({
      data: {
        assessments: [],
        meta: { current_page: 1, total_pages: 0, total_count: 0, per_page: 20 },
      },
    });
    renderPage();

    expect(await screen.findByText(/no assessments yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create your first assessment/i })).toBeInTheDocument();
  });
});
