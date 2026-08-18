import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HardwareCheck from "@/components/HardwareCheck";

// Internet check is network-bound and unrelated to F9/F10 — stub it to pass instantly.
vi.mock("@/utils/internetSpeedTest", () => ({
  DEFAULT_THRESHOLDS: { minDownloadMbps: 8, minUploadMbps: 1, maxPingMs: 300 },
  testInternetSpeed: vi.fn().mockResolvedValue({
    download: 100, upload: 100, ping: 10, passed: true,
    downloadTests: [], uploadTests: [], pingTests: [],
  }),
}));

function mockGetUserMedia(impl: () => Promise<MediaStream | never>) {
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(impl) },
    configurable: true,
  });
}

function mockMicPermission(state: "denied" | "granted" | "prompt") {
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state }) },
    configurable: true,
  });
}

const fakeStream = { getTracks: () => [] } as unknown as MediaStream;

describe("HardwareCheck (F9 + F10 regression)", () => {
  beforeEach(() => {
    mockMicPermission("prompt");
  });

  afterEach(() => {
    // @ts-expect-error — jsdom test-only globals
    delete navigator.mediaDevices;
    // @ts-expect-error
    delete navigator.permissions;
  });

  it("F9: Retry re-runs the OS & browser step instead of leaving it stuck on 'Checking...'", async () => {
    mockGetUserMedia(() => Promise.reject(new Error("Permission denied")));
    const user = userEvent.setup();

    render(<HardwareCheck />);

    // First pass: OS & browser recovers on mount, mic fails -> Retry appears.
    expect(await screen.findByRole("button", { name: /retry/i }, { timeout: 3000 })).toBeInTheDocument();
    const osRow = screen.getByText("OS & browser").closest("div")!.parentElement!;
    expect(osRow).toHaveTextContent("Passed");

    await user.click(screen.getByRole("button", { name: /retry/i }));

    // Immediately after retry, the old bug left this step wedged on "Checking...".
    // The fix must bring it back to "Passed" on its own, not require a second click.
    expect(await screen.findByText("Passed", {}, { timeout: 3000 })).toBeInTheDocument();
    const osRowAfterRetry = screen.getByText("OS & browser").closest("div")!.parentElement!;
    expect(osRowAfterRetry).not.toHaveTextContent("Checking...");
  }, 10000);

  it("F10: shows re-enable instructions once the mic is confirmed permanently denied", async () => {
    mockMicPermission("denied");
    mockGetUserMedia(() => Promise.reject(new Error("Permission denied")));

    render(<HardwareCheck />);

    expect(
      await screen.findByText(/microphone access is blocked for this site/i, {}, { timeout: 3000 })
    ).toBeInTheDocument();
  }, 10000);

  it("F10: does not show the denied-specific instructions for a transient (non-denied) mic failure", async () => {
    mockMicPermission("prompt");
    mockGetUserMedia(() => Promise.reject(new Error("No device found")));

    render(<HardwareCheck />);

    await screen.findByRole("button", { name: /retry/i }, { timeout: 3000 });
    expect(screen.queryByText(/microphone access is blocked for this site/i)).not.toBeInTheDocument();
  }, 10000);

  it("passes microphone check once getUserMedia resolves with a stream", async () => {
    mockGetUserMedia(() => Promise.resolve(fakeStream));

    render(<HardwareCheck />);

    await waitFor(
      () => {
        const micRow = screen.getByText("Microphone").closest("div")!.parentElement!;
        expect(micRow).toHaveTextContent("Passed");
      },
      { timeout: 3000 }
    );
  }, 10000);
});
