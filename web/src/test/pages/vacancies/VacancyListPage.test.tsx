import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { Provider } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import VacancyListPage from "@/pages/vacancies/VacancyListPage";
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
        <MemoryRouter initialEntries={["/vacancies"]}>
          <VacancyListPage />
        </MemoryRouter>
      </HydrateAtoms>
    </Provider>
  );
}

const mockVacancies = [
  {
    id: 1,
    role_title: "Acme Engineer",
    tenant_id: 10,
    organization_name: "Acme Corp",
    organization_scheme: "acme",
    skills: [],
    culture_dimensions: "",
    competency_expectations: "",
  },
  {
    id: 2,
    role_title: "Beta Designer",
    tenant_id: 20,
    organization_name: "Beta Ltd",
    organization_scheme: "beta",
    skills: [],
    culture_dimensions: "",
    competency_expectations: "",
  },
];

describe("VacancyListPage Super Admin Filter & Badges", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("does not render organization filter for standard assessor", async () => {
    const assessorPayload = btoa(JSON.stringify({ role: "assessor", user_id: 5 }));
    const assessorToken = `header.${assessorPayload}.sig`;

    vi.spyOn(vacanciesApi, "list").mockResolvedValue({
      data: { vacancies: [mockVacancies[0]], meta: {} as any },
    } as any);

    renderWithAuth(assessorToken);

    await waitFor(() => {
      expect(screen.getByText("Acme Engineer")).toBeInTheDocument();
      expect(screen.queryByLabelText(/Filter by organization/i)).not.toBeInTheDocument();
    });
  });

  it("renders organization filter and badges for super admin and filters on change", async () => {
    const adminPayload = btoa(JSON.stringify({ role: "admin", user_id: 1 }));
    const adminToken = `header.${adminPayload}.sig`;

    vi.spyOn(adminOrganizationsApi, "list").mockResolvedValue({
      data: {
        organizations: [
          { id: 10, name: "Acme Corp", scheme: "acme" },
          { id: 20, name: "Beta Ltd", scheme: "beta" },
        ],
      },
    } as any);

    const listSpy = vi.spyOn(vacanciesApi, "list").mockResolvedValue({
      data: { vacancies: mockVacancies, meta: {} as any },
    } as any);

    renderWithAuth(adminToken);

    await waitFor(() => {
      expect(screen.getByText("Acme Engineer")).toBeInTheDocument();
      expect(screen.getByText("Beta Designer")).toBeInTheDocument();
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("Beta Ltd")).toBeInTheDocument();
      expect(screen.getByLabelText(/Filter by organization/i)).toBeInTheDocument();
    });

    // Change filter to Beta Ltd (id 20)
    fireEvent.change(screen.getByLabelText(/Filter by organization/i), {
      target: { value: "20" },
    });

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({ organization_id: 20 })
      );
    });
  });
});
