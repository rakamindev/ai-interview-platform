import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VacancyListPage from "@/pages/vacancies/VacancyListPage";
import { vacanciesApi } from "@/services/vacancies";
import { renderWithQueryClient } from "@/test/renderWithQueryClient";

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { list: vi.fn() },
}));

const listMock = vacanciesApi.list as ReturnType<typeof vi.fn>;

const vacancy = (id: number, roleTitle = `Vacancy ${id}`) => ({
  id,
  role_title: roleTitle,
  culture_dimensions: "Collaborative",
  competency_expectations: "Strong communication",
  updated_at: "2026-10-25T00:00:00Z",
  skills: [],
});

const response = (page: number, items = [vacancy(page)]) => ({
  data: {
    vacancies: items,
    meta: { current_page: page, total_pages: 2, total_count: 24, per_page: 20 },
  },
});

function LocationState() {
  const location = useLocation();
  return <output aria-label="Current location">{location.pathname + location.search}</output>;
}

function renderPage(entry = "/vacancies") {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/vacancies"
          element={
            <>
              <VacancyListPage />
              <LocationState />
            </>
          }
        />
        <Route path="/vacancies/:id/edit" element={<p>Edit destination</p>} />
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

describe("VacancyListPage", () => {
  it("loads a URL-backed page and renders a semantic link with updated date", async () => {
    listMock.mockResolvedValue(response(2, [vacancy(22, "Senior Platform Engineer")]));
    renderPage("/vacancies?page=2");

    const cardLink = await screen.findByRole("link", { name: /senior platform engineer/i });
    expect(listMock).toHaveBeenCalledWith({ page: 2 });
    expect(cardLink).toHaveAttribute("href", "/vacancies/22/edit");
    expect(cardLink.querySelector("p")).toHaveClass("truncate");
    expect(screen.getByText(/updated/i)).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
  });

  it("moves to the next page through the URL and keeps link behavior", async () => {
    listMock.mockResolvedValueOnce(response(1)).mockResolvedValueOnce(response(2));
    renderPage();

    const user = userEvent.setup();
    await screen.findByText("Vacancy 1");
    await user.click(screen.getByRole("button", { name: /next page/i }));

    expect(await screen.findByText("Vacancy 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/vacancies?page=2");
    expect(screen.getByLabelText(/vacancy results, page 2/i)).toHaveFocus();
  });

  it("shows an exclusive retry state and retries the same page", async () => {
    listMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(response(2));
    renderPage("/vacancies?page=2");

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load vacancies");
    expect(screen.queryByText(/no vacancies yet/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Vacancy 2")).toBeInTheDocument();
    expect(listMock).toHaveBeenLastCalledWith({ page: 2 });
  });

  it("retains the creation CTA for an empty first page", async () => {
    listMock.mockResolvedValue({
      data: {
        vacancies: [],
        meta: { current_page: 1, total_pages: 0, total_count: 0, per_page: 20 },
      },
    });
    renderPage();

    expect(await screen.findByText(/no vacancies yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create your first vacancy/i })).toBeInTheDocument();
  });
});
