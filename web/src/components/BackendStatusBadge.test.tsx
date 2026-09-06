import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BackendStatusBadge from "./BackendStatusBadge";

vi.mock("@/hooks/useBackendStatus", () => ({
  useBackendStatus: vi.fn(),
}));

import { useBackendStatus } from "@/hooks/useBackendStatus";

const mockUseBackendStatus = useBackendStatus as unknown as ReturnType<
  typeof vi.fn
>;

describe("BackendStatusBadge", () => {
  beforeEach(() => {
    mockUseBackendStatus.mockReset();
    mockUseBackendStatus.mockReturnValue({
      status: "online",
      recheck: vi.fn(),
    });
  });

  it("shows the online state", () => {
    render(<BackendStatusBadge />);

    expect(screen.getByText("Backend online")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry backend check" })
    ).not.toBeInTheDocument();
  });

  it("shows the offline state with a retry button that rechecks", async () => {
    const recheck = vi.fn();
    mockUseBackendStatus.mockReturnValue({ status: "offline", recheck });
    const user = userEvent.setup();

    render(<BackendStatusBadge />);

    expect(screen.getByText("Backend offline")).toBeInTheDocument();

    const retry = screen.getByRole("button", { name: "Retry backend check" });
    await user.click(retry);

    expect(recheck).toHaveBeenCalledTimes(1);
  });

  it("shows the checking state without a retry button", () => {
    mockUseBackendStatus.mockReturnValue({ status: "checking", recheck: vi.fn() });

    render(<BackendStatusBadge />);

    expect(screen.getByText("Checking…")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry backend check" })
    ).not.toBeInTheDocument();
  });
});