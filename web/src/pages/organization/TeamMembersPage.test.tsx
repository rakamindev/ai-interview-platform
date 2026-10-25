import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TeamMembersPage from "./TeamMembersPage";
import { authApi } from "@/services/auth";

vi.mock("@/services/auth", () => ({
  authApi: {
    getMembers: vi.fn(),
    inviteMember: vi.fn(),
    removeMember: vi.fn(),
  },
}));

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtomValue: vi.fn((_atom) => {
      return {
        user: { id: 1, email: "admin@corp.com", role: "admin" },
        id: 10,
        name: "Acme Corp",
        scheme: "acme-corp",
      };
    }),
  };
});

describe("TeamMembersPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders members table with properly formatted joined dates", async () => {
    vi.mocked(authApi.getMembers).mockResolvedValueOnce({
      data: {
        members: [
          {
            id: 1,
            user_id: 1,
            email: "admin@corp.com",
            role: "admin",
            joined_at: "2026-10-25T10:00:00Z",
            created_at: "2026-10-25T10:00:00Z",
          },
          {
            id: 2,
            user_id: 2,
            email: "assessor@corp.com",
            role: "assessor",
            joined_at: "2026-10-20T14:30:00Z",
          },
        ],
      },
    } as any);

    render(<TeamMembersPage />);

    expect(screen.getByText(/Memuat daftar anggota tim.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("admin@corp.com")).toBeInTheDocument();
      expect(screen.getByText("assessor@corp.com")).toBeInTheDocument();
    });

    // Check roles
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Assessor")).toBeInTheDocument();

    // Check formatted joined date (e.g. 25 Okt 2026 and 20 Okt 2026)
    expect(screen.getByText(/25 Okt 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/20 Okt 2026/i)).toBeInTheDocument();
  });

  it("handles empty member list", async () => {
    vi.mocked(authApi.getMembers).mockResolvedValueOnce({
      data: {
        members: [],
      },
    } as any);

    render(<TeamMembersPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Belum ada anggota lain di organisasi ini/i)
      ).toBeInTheDocument();
    });
  });
});
