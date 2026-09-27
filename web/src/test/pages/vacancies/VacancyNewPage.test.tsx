import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { Provider } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import VacancyNewPage from "@/pages/vacancies/VacancyNewPage";
import { authAtom } from "@/stores/authAtom";
import { adminOrganizationsApi } from "@/services/adminOrganizations";
import { vacanciesApi } from "@/services/vacancies";

function HydrateAtoms({ initialValues, children }: { initialValues: any; children: React.ReactNode }) {
  useHydrateAtoms(initialValues);
  return <>{children}</>;
}

function renderWithAuth(token: string | null) {
  return render(
    <Provider>
      <HydrateAtoms initialValues={[[authAtom, { token }]]}>
        <MemoryRouter initialEntries={["/vacancies/new"]}>
          <VacancyNewPage />
        </MemoryRouter>
      </HydrateAtoms>
    </Provider>
  );
}

const mockOrganizations = [
  { id: 101, name: "GoTo Group", scheme: "goto" },
  { id: 102, name: "Traveloka", scheme: "traveloka" },
];

describe("VacancyNewPage Super Admin Organization Selection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("does not render organization selector for standard tenant assessor", () => {
    const assessorPayload = btoa(JSON.stringify({ role: "assessor", user_id: 5 }));
    const assessorToken = `header.${assessorPayload}.sig`;

    renderWithAuth(assessorToken);

    expect(screen.queryByLabelText(/Organization/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Role title/i)).toBeInTheDocument();
  });

  it("renders organization selector and submits selected organization_id for super admin", async () => {
    const adminPayload = btoa(JSON.stringify({ role: "admin", user_id: 1 }));
    const adminToken = `header.${adminPayload}.sig`;

    vi.spyOn(adminOrganizationsApi, "list").mockResolvedValue({
      data: { organizations: mockOrganizations },
    } as any);

    const createSpy = vi.spyOn(vacanciesApi, "create").mockResolvedValue({
      data: { vacancy: { id: 1, role_title: "Staff Engineer" } },
    } as any);

    renderWithAuth(adminToken);

    await waitFor(() => {
      expect(screen.getByLabelText(/Organization/i)).toBeInTheDocument();
      expect(screen.getByText("GoTo Group (goto)")).toBeInTheDocument();
      expect(screen.getByText("Traveloka (traveloka)")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Organization/i), { target: { value: "102" } });
    fireEvent.change(screen.getByLabelText(/Role title/i), { target: { value: "Staff Engineer" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Vacancy/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          role_title: "Staff Engineer",
          organization_id: 102,
        })
      );
    });
  });

  it("shows validation error if super admin does not select an organization", async () => {
    const adminPayload = btoa(JSON.stringify({ role: "admin", user_id: 1 }));
    const adminToken = `header.${adminPayload}.sig`;

    vi.spyOn(adminOrganizationsApi, "list").mockResolvedValue({
      data: { organizations: mockOrganizations },
    } as any);

    const createSpy = vi.spyOn(vacanciesApi, "create");

    renderWithAuth(adminToken);

    await waitFor(() => {
      expect(screen.getByLabelText(/Organization/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Role title/i), { target: { value: "Staff Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Vacancy/i }));

    await waitFor(() => {
      expect(screen.getByText(/Please select an organization/i)).toBeInTheDocument();
      expect(createSpy).not.toHaveBeenCalled();
    });
  });
});
