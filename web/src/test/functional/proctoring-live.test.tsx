import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import {
  type Client, FakeAudioWorkletNode, completeProctoringSetup, fakeScreens, installDevices, openInvite, pressStart, send, streams,
} from "../interview";
import { testInternetSpeed } from "@/utils/internetSpeedTest";

// A proctored interview in the live page: the setup, then the pause while the camera, the screen share or the
// one-screen rule is off. The devices, the screens and the audio socket are faked in ../interview.

vi.mock("@/utils/internetSpeedTest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/internetSpeedTest")>()),
  testInternetSpeed: vi.fn(),
}));

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

let screens: ReturnType<typeof fakeScreens>;

beforeEach(() => {
  vi.mocked(testInternetSpeed).mockResolvedValue({
    download: 56, upload: 8, ping: 32, passed: true, downloadTests: [], uploadTests: [], pingTests: [],
  });
  installDevices();
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(CHROME);
  screens = fakeScreens(false);
});

afterEach(() => {
  screens.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(testInternetSpeed).mockReset();
});

/**
 * Starts a proctored interview with the candidate's turn open. Returns what the page sent: its proctoring events and
 * how many microphone frames reached the server.
 */
async function startProctored() {
  const sent = { events: [] as string[], frames: 0 };
  openInvite({ proctoring_required: true }, (client: Client) => {
    client.addEventListener("message", (e) => {
      if (typeof e.data !== "string") return void (sent.frames += 1);
      const message = JSON.parse(e.data);
      if (message.type === "proctoring") sent.events.push(message.event);
    });
    send(client, { type: "session_started" });
    send(client, { type: "speaker_changed", speaker: "candidate" });
  });
  await completeProctoringSetup();
  await pressStart();
  await screen.findByText("Your turn");
  return sent;
}

/** One frame from the microphone; resolves once it has had time to reach the socket. */
async function speak() {
  await act(async () => {
    FakeAudioWorkletNode.last!.speak();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe("A proctored interview", { timeout: 20000 }, () => {
  it("starts on one screen, with the camera and screen shared, and sends the microphone", async () => {
    const sent = await startProctored();

    await speak();
    await waitFor(() => expect(sent.frames).toBe(1));
    expect(screen.queryByRole("alertdialog", { name: "Interview paused" })).not.toBeInTheDocument();
  });

  it("pauses while the camera is off, and tells the server", async () => {
    const sent = await startProctored();
    const camera = streams.find(({ constraints }) => constraints.video)!.track;

    act(() => {
      camera.readyState = "ended";
      camera.dispatchEvent(new Event("ended"));
    });

    expect(await screen.findByRole("alertdialog", { name: "Interview paused" })).toHaveTextContent("Your camera stopped");
    await waitFor(() => expect(sent.events).toEqual(["camera_stopped"]));
    await speak();
    expect(sent.frames).toBe(0);
  });

  it("holds Start while a second screen is connected, and lets go once it's disconnected", async () => {
    screens = fakeScreens(true);
    openInvite({ proctoring_required: true });
    await completeProctoringSetup();

    expect(await screen.findByText(/A second screen is connected/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Interview" })).toBeDisabled();

    act(() => screens.set(false));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start Interview" })).toBeEnabled(), { timeout: 10000 });
  });

  it("pauses when a second screen is plugged in, tells the server, and carries on once it's out", async () => {
    const sent = await startProctored();

    act(() => screens.set(true));

    expect(await screen.findByRole("alertdialog", { name: "Interview paused" })).toHaveTextContent(/second screen/);
    await waitFor(() => expect(sent.events).toEqual(["second_screen_connected"]));
    await speak();
    expect(sent.frames).toBe(0);

    act(() => screens.set(false));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(sent.events).toEqual(["second_screen_connected", "second_screen_disconnected"]));
    await speak();
    await waitFor(() => expect(sent.frames).toBe(1));
  });
});
