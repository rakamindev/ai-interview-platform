import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithRouter } from "@/test/utils";
import LiveMonitorPage from "./LiveMonitorPage";

vi.mock("@/hooks/useCoverageWebSocket", () => ({
  useCoverageWebSocket: () => ({
    coverageMap: null,
    sessionEnded: false,
    sessionEndReason: null,
    isConnected: true,
  }),
}));

const ROUTE = "/assessments/1/sessions/5/monitor";

describe("LiveMonitorPage", () => {
  it("shows the assessment name (regression: was read from the wrong object)", async () => {
    renderWithRouter(<LiveMonitorPage />, ROUTE);

    await waitFor(() => expect(screen.getByText("Live Monitor")).toBeInTheDocument());
    expect(screen.getByText("Frontend Engineer Assessment")).toBeInTheDocument();
  });
});