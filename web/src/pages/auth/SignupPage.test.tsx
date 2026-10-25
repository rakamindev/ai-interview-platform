import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SignupPage from "./SignupPage";
import { authApi } from "@/services/auth";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/services/auth", () => ({
  authApi: {
    signupOrganization: vi.fn(),
    signupUser: vi.fn(),
  },
}));

describe("SignupPage Dual Registration Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders both Perusahaan (Admin) and Akun Pribadi (User) tabs", () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("tab", { name: /Perusahaan \(Admin\)/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Akun Pribadi \(User\)/i })).toBeInTheDocument();
  });

  it("submits organization signup with organization name, email, and password", async () => {
    vi.mocked(authApi.signupOrganization).mockResolvedValueOnce({
      data: {
        token: "org-jwt-token",
        user: { id: 1, email: "admin@corp.com", role: "admin" },
        active_organization: { id: 10, name: "Acme Corp", scheme: "acme-corp" },
        organizations: [{ id: 10, name: "Acme Corp", scheme: "acme-corp", role: "admin" }],
      },
    } as any);

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nama Organisasi \/ Perusahaan/i), {
      target: { value: "Acme Corp" },
    });
    fireEvent.change(screen.getByLabelText(/Email Administrator/i), {
      target: { value: "admin@corp.com" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "secret123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Daftarkan Organisasi & Akun Admin/i }));

    await waitFor(() => {
      expect(authApi.signupOrganization).toHaveBeenCalledWith({
        organization_name: "Acme Corp",
        email: "admin@corp.com",
        password: "secret123",
      });
      expect(mockNavigate).toHaveBeenCalledWith("/assessments");
    });
  });

  it("switches to standalone user tab and submits personal account registration", async () => {
    vi.mocked(authApi.signupUser).mockResolvedValueOnce({
      data: {
        token: "user-jwt-token",
        user: { id: 2, email: "user@email.com", role: "user" },
        active_organization: null,
        organizations: [],
      },
    } as any);

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    );

    // Click tab "Akun Pribadi (User)"
    const userTab = screen.getByRole("tab", { name: /Akun Pribadi \(User\)/i });
    fireEvent.mouseDown(userTab, { button: 0, ctrlKey: false });
    fireEvent.click(userTab);

    // User tab fields
    expect(screen.getByLabelText(/Email Pribadi/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nama Organisasi \/ Perusahaan/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Email Pribadi/i), {
      target: { value: "user@email.com" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Daftar Akun Pribadi/i }));

    await waitFor(() => {
      expect(authApi.signupUser).toHaveBeenCalledWith({
        email: "user@email.com",
        password: "password123",
      });
      expect(mockNavigate).toHaveBeenCalledWith("/assessments");
    });
  });

  it("masks internal 500 server errors and prevents leaking stack traces to the user", async () => {
    vi.mocked(authApi.signupOrganization).mockRejectedValueOnce({
      response: {
        status: 500,
        data: {
          error: "undefined method 'parameterize' for 'PT Test':String",
          errors: [{ status: 500, message: "undefined method 'parameterize' for 'PT Test':String" }],
        },
      },
    });

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nama Organisasi \/ Perusahaan/i), {
      target: { value: "PT Test" },
    });
    fireEvent.change(screen.getByLabelText(/Email Administrator/i), {
      target: { value: "test@corp.com" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "secret123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Daftarkan Organisasi & Akun Admin/i }));

    await waitFor(() => {
      // Must NOT leak "undefined method" or raw internal exception
      expect(screen.queryByText(/undefined method/i)).not.toBeInTheDocument();
      // Must show friendly Indonesian error message
      expect(screen.getByText(/Terjadi kendala pada server saat mendaftarkan organisasi/i)).toBeInTheDocument();
    });
  });

  it("displays clean 422 validation message when email is taken", async () => {
    vi.mocked(authApi.signupOrganization).mockRejectedValueOnce({
      response: {
        status: 422,
        data: {
          error: "Email has already been taken",
          errors: [{ status: 422, message: "Email has already been taken" }],
        },
      },
    });

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Nama Organisasi \/ Perusahaan/i), {
      target: { value: "Existing Org" },
    });
    fireEvent.change(screen.getByLabelText(/Email Administrator/i), {
      target: { value: "taken@corp.com" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "secret123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Daftarkan Organisasi & Akun Admin/i }));

    await waitFor(() => {
      expect(screen.getByText("Email has already been taken")).toBeInTheDocument();
    });
  });
});
