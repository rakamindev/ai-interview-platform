import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminInvitationsPage from "@/pages/admin/AdminInvitationsPage";
import { adminInvitationsApi, type AdminInvitation } from "@/services/adminInvitations";
import { renderWithQueryClient } from "@/test/renderWithQueryClient";

vi.mock("@/services/adminInvitations", () => ({
  adminInvitationsApi: {
    list: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
  },
}));

vi.mock("@/stores/toastStore", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const listMock = adminInvitationsApi.list as ReturnType<typeof vi.fn>;
const createMock = adminInvitationsApi.create as ReturnType<typeof vi.fn>;
const revokeMock = adminInvitationsApi.revoke as ReturnType<typeof vi.fn>;

const INVITATION: AdminInvitation = {
  id: "invitation-1",
  recipient_email: "recipient@example.com",
  status: "active",
  expires_at: "2026-10-25T00:00:00Z",
  accepted_at: null,
  revoked_at: null,
  created_at: "2026-10-24T00:00:00Z",
  inviter_email: "admin@example.com",
  organization: { id: 1, name: "Tenant A" },
};

beforeEach(() => {
  listMock.mockReset();
  createMock.mockReset();
  revokeMock.mockReset();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("AdminInvitationsPage", () => {
  it("renders an empty state after loading", async () => {
    listMock.mockResolvedValue({ data: { invitations: [] } });
    renderWithQueryClient(<AdminInvitationsPage />);

    expect(await screen.findByText(/no administrator invitations yet/i)).toBeInTheDocument();
  });

  it("creates an invitation, reveals its link once, and copies it", async () => {
    listMock.mockResolvedValue({ data: { invitations: [] } });
    createMock.mockResolvedValue({
      data: {
        invitation: INVITATION,
        signup_url: "http://localhost:5173/signup?invitation=raw-token",
      },
    });
    renderWithQueryClient(<AdminInvitationsPage />);

    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await screen.findByText(/no administrator invitations yet/i);
    await user.type(screen.getByLabelText(/recipient email/i), "recipient@example.com");
    await user.click(screen.getByRole("button", { name: /create invitation/i }));

    expect(createMock).toHaveBeenCalledWith("recipient@example.com");
    const link = await screen.findByLabelText(/new administrator invitation link/i);
    expect(link).toHaveValue("http://localhost:5173/signup?invitation=raw-token");
    expect(screen.getByText("recipient@example.com")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^copy$/i }));
    expect(writeTextSpy).toHaveBeenCalledWith(
      "http://localhost:5173/signup?invitation=raw-token"
    );
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("lists active invitations and revokes one without a false success", async () => {
    listMock.mockResolvedValue({ data: { invitations: [INVITATION] } });
    revokeMock.mockResolvedValue({
      data: {
        invitation: { ...INVITATION, status: "revoked", revoked_at: "2026-10-24T01:00:00Z" },
      },
    });
    renderWithQueryClient(<AdminInvitationsPage />);

    const user = userEvent.setup();
    expect(await screen.findByText("recipient@example.com")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /revoke/i }));

    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith("invitation-1"));
    expect(await screen.findByText("revoked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revoke/i })).not.toBeInTheDocument();
  });

  it("shows load failure and retries", async () => {
    listMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ data: { invitations: [INVITATION] } });
    renderWithQueryClient(<AdminInvitationsPage />);

    expect(await screen.findByText(/failed to load invitations/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("recipient@example.com")).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(2);
  });
});
