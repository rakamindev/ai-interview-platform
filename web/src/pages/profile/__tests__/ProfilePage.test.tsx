import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProfilePage from "../ProfilePage";
import { authApi } from "@/services/auth";

vi.mock("@/services/auth", () => ({
  authApi: {
    getMe: vi.fn(),
  },
}));

describe("ProfilePage - User Profile & Tenant Information", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders user details, moved tenant profile section, and security compliance", async () => {
    vi.mocked(authApi.getMe).mockResolvedValueOnce({
      data: {
        user: {
          id: 1,
          email: "admin@example.com",
          role: "admin",
        },
        tenant: {
          id: "test-corp",
          name: "Test Corp",
        },
      },
    } as any);

    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify User Profile header and details after loading
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "User Profile" })).toBeInTheDocument();
      expect(screen.getByText("Account Details")).toBeInTheDocument();
      expect(screen.getByText("admin@example.com")).toBeInTheDocument();
      expect(screen.getByText("Tenant Profile")).toBeInTheDocument();
      expect(screen.getByText("Test Corp")).toBeInTheDocument();
      expect(screen.getByText("test-corp")).toBeInTheDocument();
      expect(screen.getByText("Session Security")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sign Out/i })).toBeInTheDocument();
    });

    // Ensure User ID and Status Active Session are removed
    expect(screen.queryByText(/User ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Active Session/i)).not.toBeInTheDocument();
  });
});
