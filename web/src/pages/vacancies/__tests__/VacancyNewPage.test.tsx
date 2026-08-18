import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VacancyNewPage from "@/pages/vacancies/VacancyNewPage";
import { vacanciesApi } from "@/services/vacancies";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: { create: vi.fn() },
}));

function renderPage() {
  render(
    <MemoryRouter>
      <VacancyNewPage />
    </MemoryRouter>
  );
}

describe("VacancyNewPage — required-field validation message (F17 regression)", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.mocked(vacanciesApi.create).mockReset();
  });

  it("shows an inline 'Role title is required' message and does not submit when left blank", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /save vacancy/i }));

    expect(await screen.findByText(/role title is required/i)).toBeInTheDocument();
    expect(vacanciesApi.create).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("submits and navigates away once a role title is filled in", async () => {
    vi.mocked(vacanciesApi.create).mockResolvedValue({ data: { vacancy: { id: 1 } } } as never);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/role title/i), "Senior Backend Engineer");
    await user.click(screen.getByRole("button", { name: /save vacancy/i }));

    expect(screen.queryByText(/role title is required/i)).not.toBeInTheDocument();
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/vacancies"));
    expect(vacanciesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ role_title: "Senior Backend Engineer" })
    );
  });
});
