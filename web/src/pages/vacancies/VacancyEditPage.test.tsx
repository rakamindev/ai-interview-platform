import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import VacancyEditPage from "./VacancyEditPage";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/vacancies", () => ({ vacanciesApi: { get: vi.fn(), update: vi.fn() } }));
vi.mock("@/services/skillTaxonomies", () => ({ skillTaxonomiesApi: { list: vi.fn().mockResolvedValue({ data: { skill_taxonomies: [] } }) } }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/vacancies/7/edit"]}>
      <Routes>
        <Route path="/vacancies/:id/edit" element={<VacancyEditPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("VacancyEditPage", () => {
  beforeEach(() => vi.clearAllMocks());

  // Regression: a failed load used to render an EMPTY form that could be saved over the real vacancy.
  it("shows an error with retry instead of an empty, saveable form when the vacancy fails to load", async () => {
    vi.mocked(vacanciesApi.get).mockRejectedValue(new Error("network"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load");
    expect(screen.queryByRole("button", { name: /simpan|save/i })).not.toBeInTheDocument();
  });

  it("retry loads the vacancy again", async () => {
    vi.mocked(vacanciesApi.get)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ data: { vacancy: { role_title: "Backend", skills: [] } } } as any);

    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /try again/i }));

    await waitFor(() => expect(vacanciesApi.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
