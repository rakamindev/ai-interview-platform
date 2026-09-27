import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import { adminUsersApi } from "@/services/adminUsers";
import { adminOrganizationsApi } from "@/services/adminOrganizations";

const mockUsers = [
  {
    id: 1,
    email: "super@admin.com",
    role: "admin",
    created_at: "2026-09-20T00:00:00Z",
  },
  {
    id: 2,
    email: "assessor@acme.com",
    role: "assessor",
    organization_id: 10,
    organization_name: "Acme Corp",
    organization_scheme: "acme-corp",
    created_at: "2026-09-21T00:00:00Z",
  },
];

const mockOrganizations = [
  {
    id: 10,
    name: "Acme Corp",
    scheme: "acme-corp",
    identifier: "org-acme-1",
    host: "acme.interview.local",
    created_at: "2026-09-20T00:00:00Z",
  },
];

describe("AdminUsersPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders page header and loads users and organizations successfully", async () => {
    vi.spyOn(adminUsersApi, "list").mockResolvedValue({
      data: { users: mockUsers },
    } as any);
    vi.spyOn(adminOrganizationsApi, "list").mockResolvedValue({
      data: { organizations: mockOrganizations },
    } as any);

    render(<AdminUsersPage />);

    expect(screen.getByText("Platform Administration")).toBeInTheDocument();
    expect(screen.getByText("Super Admin Only")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("super@admin.com")).toBeInTheDocument();
      expect(screen.getByText("assessor@acme.com")).toBeInTheDocument();
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
  });

  it("filters users when typing in search input", async () => {
    vi.spyOn(adminUsersApi, "list").mockResolvedValue({
      data: { users: mockUsers },
    } as any);
    vi.spyOn(adminOrganizationsApi, "list").mockResolvedValue({
      data: { organizations: mockOrganizations },
    } as any);

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText("super@admin.com")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search email or organization...");
    fireEvent.change(searchInput, { target: { value: "acme" } });

    expect(screen.getByText("assessor@acme.com")).toBeInTheDocument();
    expect(screen.queryByText("super@admin.com")).not.toBeInTheDocument();
  });

  it("filters users by role filter buttons", async () => {
    vi.spyOn(adminUsersApi, "list").mockResolvedValue({
      data: { users: mockUsers },
    } as any);
    vi.spyOn(adminOrganizationsApi, "list").mockResolvedValue({
      data: { organizations: mockOrganizations },
    } as any);

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText("super@admin.com")).toBeInTheDocument();
    });

    // Click 'Super Admins (1)'
    const superAdminFilterBtn = screen.getByRole("button", { name: /Super Admins/i });
    fireEvent.click(superAdminFilterBtn);

    expect(screen.getByText("super@admin.com")).toBeInTheDocument();
    expect(screen.queryByText("assessor@acme.com")).not.toBeInTheDocument();

    // Click 'Assessors (1)'
    const assessorsFilterBtn = screen.getByRole("button", { name: /Assessors/i });
    fireEvent.click(assessorsFilterBtn);

    expect(screen.queryByText("super@admin.com")).not.toBeInTheDocument();
    expect(screen.getByText("assessor@acme.com")).toBeInTheDocument();
  });

  it("switches to Organizations tab and displays registered tenants", async () => {
    vi.spyOn(adminUsersApi, "list").mockResolvedValue({
      data: { users: mockUsers },
    } as any);
    vi.spyOn(adminOrganizationsApi, "list").mockResolvedValue({
      data: { organizations: mockOrganizations },
    } as any);

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText("super@admin.com")).toBeInTheDocument();
    });

    const orgsTab = screen.getByRole("tab", { name: /Organizations/i });
    fireEvent.pointerDown(orgsTab, { button: 0, ctrlKey: false });
    fireEvent.keyDown(orgsTab, { key: "Enter" });

    expect(screen.getByText("Registered Client Tenants")).toBeInTheDocument();
    expect(screen.getByText("acme-corp")).toBeInTheDocument();
    expect(screen.getByText("org-acme-1")).toBeInTheDocument();
  });

  it("displays error banner when loading admin data fails", async () => {
    vi.spyOn(adminUsersApi, "list").mockRejectedValue(new Error("Unauthorized"));
    vi.spyOn(adminOrganizationsApi, "list").mockRejectedValue(new Error("Unauthorized"));

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to load admin data. Ensure you are signed in with a Super Admin account./i)
      ).toBeInTheDocument();
    });
  });

  it("opens Create User modal when clicking 'New User' button", async () => {
    vi.spyOn(adminUsersApi, "list").mockResolvedValue({
      data: { users: mockUsers },
    } as any);
    vi.spyOn(adminOrganizationsApi, "list").mockResolvedValue({
      data: { organizations: mockOrganizations },
    } as any);

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText("super@admin.com")).toBeInTheDocument();
    });

    const newUserBtn = screen.getByRole("button", { name: /New User/i });
    fireEvent.click(newUserBtn);

    expect(screen.getByText("Provision New User")).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Initial Password/i)).toBeInTheDocument();
  });

  it("opens Create Organization modal when clicking 'New Organization' button", async () => {
    vi.spyOn(adminUsersApi, "list").mockResolvedValue({
      data: { users: mockUsers },
    } as any);
    vi.spyOn(adminOrganizationsApi, "list").mockResolvedValue({
      data: { organizations: mockOrganizations },
    } as any);

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText("super@admin.com")).toBeInTheDocument();
    });

    const newOrgBtn = screen.getByRole("button", { name: /New Organization/i });
    fireEvent.click(newOrgBtn);

    expect(screen.getByRole("heading", { name: /Create Organization/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Organization Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Organization Slug/i)).toBeInTheDocument();
  });
});
