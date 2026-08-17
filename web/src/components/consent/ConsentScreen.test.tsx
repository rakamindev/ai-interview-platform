import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConsentScreen from "@/components/consent/ConsentScreen";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
  sessionsApi: { grantConsent: vi.fn() },
}));

const grantedMock = vi.mocked(sessionsApi.grantConsent);

describe("ConsentScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the disclosure and the consent version", () => {
    render(
      <ConsentScreen
        token="tk"
        roleTitle="Frontend Engineer"
        timeLimitMin={45}
        version="2026-08-17"
        onGranted={() => {}}
      />
    );

    expect(
      screen.getByRole("heading", { name: /before you start/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/disclosure version 2026-08-17/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /i agree & continue/i })
    ).toBeInTheDocument();
  });

  it("grants consent on agree and notifies the parent", async () => {
    const user = userEvent.setup();
    const onGranted = vi.fn();
    grantedMock.mockResolvedValueOnce({ data: { status: "granted" } } as never);

    render(
      <ConsentScreen
        token="tk"
        roleTitle="Frontend Engineer"
        timeLimitMin={45}
        version="2026-08-17"
        onGranted={onGranted}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /i agree & continue/i })
    );

    await waitFor(() => expect(onGranted).toHaveBeenCalled());
    expect(grantedMock).toHaveBeenCalledWith("tk", "2026-08-17");
  });

  it("shows an inline error and does not proceed on failure", async () => {
    const user = userEvent.setup();
    const onGranted = vi.fn();
    grantedMock.mockRejectedValueOnce(new Error("boom"));

    render(
      <ConsentScreen
        token="tk"
        roleTitle="Frontend Engineer"
        timeLimitMin={45}
        version="2026-08-17"
        onGranted={onGranted}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /i agree & continue/i })
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onGranted).not.toHaveBeenCalled();
  });
});
