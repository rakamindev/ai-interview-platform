import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VacancyEditPage from "@/pages/vacancies/VacancyEditPage";
import { vacanciesApi } from "@/services/vacancies";

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { get: vi.fn(), update: vi.fn() },
}));

vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: { list: vi.fn().mockResolvedValue({ data: { skill_taxonomies: [] } }) },
}));

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/vacancies/:id/edit", element: <VacancyEditPage /> },
      { path: "/vacancies", element: <p>Vacancy list</p> },
    ],
    { initialEntries: ["/vacancies/5/edit"] },
  );
  render(<RouterProvider router={router} />);
}

describe("VacancyEditPage", () => {
  beforeEach(() => {
    vi.mocked(vacanciesApi.get).mockResolvedValue({
      data: {
        vacancy: {
          id: 5,
          role_title: "Frontend Engineer",
          culture_dimensions: "Async-first",
          competency_expectations: "Leads projects",
          skills: [
            { id: 21, skill_label: "React", expected_level: 3 },
            { id: 22, skill_label: "Testing", expected_level: 4 },
          ],
        },
      },
    } as Awaited<ReturnType<typeof vacanciesApi.get>>);
    vi.mocked(vacanciesApi.update).mockReset();
  });

  it("shows the save error and stays on the form when saving fails", async () => {
    const config = { headers: new AxiosHeaders() };
    vi.mocked(vacanciesApi.update).mockRejectedValue(
      new AxiosError("Unprocessable", "ERR_BAD_REQUEST", config, null, {
        status: 422,
        statusText: "",
        headers: {},
        config,
        data: { errors: [{ message: "Role title can't be blank" }] },
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue("Frontend Engineer");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Role title can't be blank")).toBeInTheDocument();
    expect(screen.queryByText("Vacancy list")).not.toBeInTheDocument();
  });

  it("marks a removed skill for deletion", async () => {
    vi.mocked(vacanciesApi.update).mockResolvedValue(
      {} as Awaited<ReturnType<typeof vacanciesApi.update>>,
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue("Frontend Engineer");
    await user.click(screen.getAllByRole("button", { name: "Remove skill" })[1]);
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(vacanciesApi.update).toHaveBeenCalled());
    const [, payload] = vi.mocked(vacanciesApi.update).mock.calls[0];
    expect(payload.vacancy_skills_attributes).toEqual([
      expect.objectContaining({ id: 21, skill_label: "React" }),
      { id: 22, _destroy: true },
    ]);
  });

  it("requires a role title", async () => {
    const user = userEvent.setup();
    renderPage();

    const title = await screen.findByLabelText(/Role title/);
    await user.clear(title);
    await user.type(title, "  ");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Role title is required")).toBeInTheDocument();
    expect(vacanciesApi.update).not.toHaveBeenCalled();
  });

  it("does not allow every expected skill to be removed", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue("Frontend Engineer");
    await user.click(screen.getAllByRole("button", { name: "Remove skill" })[1]);
    await user.click(screen.getByRole("button", { name: "Remove skill" }));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("At least one skill is required")).toBeInTheDocument();
    expect(vacanciesApi.update).not.toHaveBeenCalled();
  });
});
