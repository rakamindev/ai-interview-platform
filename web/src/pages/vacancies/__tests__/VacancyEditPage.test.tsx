import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VacancyEditPage from "@/pages/vacancies/VacancyEditPage";
import { vacanciesApi } from "@/services/vacancies";

// Radix's RadioGroup (used by LevelRadio) reads element size via ResizeObserver,
// which jsdom doesn't implement.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { get: vi.fn(), update: vi.fn() },
}));

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/vacancies/1/edit"]}>
      <Routes>
        <Route path="/vacancies/:id/edit" element={<VacancyEditPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const vacancyFixture = {
  id: 1,
  role_title: "Senior Backend Engineer",
  culture_dimensions: "Ownership-driven",
  competency_expectations: "Strong communicator",
  skills: [{ id: 1, skill_id: 1, skill_label: "Ruby on Rails", expected_level: 4 }],
};

describe("VacancyEditPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.mocked(vacanciesApi.get).mockReset();
    vi.mocked(vacanciesApi.update).mockReset();
  });

  it("shows a loading skeleton, then renders the fetched vacancy's fields", async () => {
    vi.mocked(vacanciesApi.get).mockResolvedValueOnce({
      data: { vacancy: vacancyFixture },
    } as never);

    renderPage();

    expect(await screen.findByDisplayValue("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ownership-driven")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Strong communicator")).toBeInTheDocument();
    expect(screen.getByText("Ruby on Rails")).toBeInTheDocument();
    expect(vacanciesApi.get).toHaveBeenCalledWith(1);
  });

  it("submits the edited role title and navigates back to /vacancies", async () => {
    vi.mocked(vacanciesApi.get).mockResolvedValueOnce({
      data: { vacancy: vacancyFixture },
    } as never);
    vi.mocked(vacanciesApi.update).mockResolvedValueOnce({
      data: { vacancy: { ...vacancyFixture, role_title: "Staff Backend Engineer" } },
    } as never);
    const user = userEvent.setup();

    renderPage();

    const roleTitleInput = await screen.findByDisplayValue("Senior Backend Engineer");
    await user.clear(roleTitleInput);
    await user.type(roleTitleInput, "Staff Backend Engineer");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/vacancies"));
    expect(vacanciesApi.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        role_title: "Staff Backend Engineer",
        vacancy_skills_attributes: vacancyFixture.skills,
      })
    );
  });

  it("disables the submit button while the update request is in flight", async () => {
    vi.mocked(vacanciesApi.get).mockResolvedValueOnce({
      data: { vacancy: vacancyFixture },
    } as never);
    let resolveUpdate!: (value: { data: { vacancy: typeof vacancyFixture } }) => void;
    vi.mocked(vacanciesApi.update).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }) as never
    );
    const user = userEvent.setup();

    renderPage();

    await screen.findByDisplayValue("Senior Backend Engineer");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();

    resolveUpdate({ data: { vacancy: vacancyFixture } });
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });
});
