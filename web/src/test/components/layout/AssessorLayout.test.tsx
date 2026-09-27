import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { Provider } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import AssessorLayout from "@/components/layout/AssessorLayout";
import { authAtom } from "@/stores/authAtom";

// Helper component to hydrate Jotai atoms in test
function HydrateAtoms({ initialValues, children }: { initialValues: any; children: React.ReactNode }) {
  useHydrateAtoms(initialValues);
  return <>{children}</>;
}

function renderWithAuth(token: string | null) {
  return render(
    <Provider>
      <HydrateAtoms initialValues={[[authAtom, { token }]]}>
        <MemoryRouter initialEntries={["/assessments"]}>
          <AssessorLayout />
        </MemoryRouter>
      </HydrateAtoms>
    </Provider>
  );
}

describe("AssessorLayout Navigation Role Visibility", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("does not render Admin navigation link when token is null or standard assessor", () => {
    // assessor token: { role: 'assessor', user_id: 5 }
    const assessorPayload = btoa(JSON.stringify({ role: "assessor", user_id: 5 }));
    const assessorToken = `header.${assessorPayload}.sig`;

    renderWithAuth(assessorToken);

    expect(screen.getByRole("link", { name: /Assessments/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vacancies/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Admin/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Tenant:/i)).toBeInTheDocument();
    expect(screen.queryByText(/Super Admin \(All Tenants\)/i)).not.toBeInTheDocument();
  });

  it("renders Admin navigation link and Super Admin badge when token has role 'admin'", () => {
    // admin token: { role: 'admin', user_id: 1 }
    const adminPayload = btoa(JSON.stringify({ role: "admin", user_id: 1 }));
    const adminToken = `header.${adminPayload}.sig`;

    renderWithAuth(adminToken);

    expect(screen.getByRole("link", { name: /Assessments/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vacancies/i })).toBeInTheDocument();
    const adminLink = screen.getByRole("link", { name: /Admin/i });
    expect(adminLink).toBeInTheDocument();
    expect(adminLink).toHaveAttribute("href", "/admin/users");
    expect(screen.getByText(/Super Admin \(All Tenants\)/i)).toBeInTheDocument();
  });
});
