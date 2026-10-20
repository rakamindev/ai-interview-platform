import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProctoringSetup from "./ProctoringSetup";

function fakeStream(displaySurface?: string) {
  const track = { stop: vi.fn(), getSettings: () => ({ displaySurface }), addEventListener: vi.fn(), removeEventListener: vi.fn() };
  return { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
}

function devices({ screenSurface = "monitor", camera = true }: { screenSurface?: string; camera?: boolean } = {}) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getDisplayMedia: vi.fn().mockResolvedValue(fakeStream(screenSurface)),
      getUserMedia: camera ? vi.fn().mockResolvedValue(fakeStream()) : vi.fn().mockRejectedValue(new DOMException("no", "NotAllowedError")),
    },
  });
}

// The page holds the streams and watches the screens; this stands in for it.
function Harness({ secondScreen = false }: { secondScreen?: boolean }) {
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const [screenShare, setScreen] = useState<MediaStream | null>(null);
  const [ack, setAck] = useState(false);
  return (
    <ProctoringSetup camera={camera} screen={screenShare} secondScreen={secondScreen} acknowledged={ack}
      onCamera={setCamera} onScreen={setScreen} onAcknowledge={setAck} />
  );
}

afterEach(() => vi.restoreAllMocks());

describe("ProctoringSetup", () => {
  it("says what is checked and that nothing is recorded, before anything is turned on", () => {
    devices();
    render(<Harness />);

    expect(screen.getByRole("heading", { name: "Camera and screen sharing" })).toBeInTheDocument();
    expect(screen.getByText(/not a tab or a window/)).toBeInTheDocument();
    expect(screen.getByText(/not recorded or stored/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /I understand/ })).not.toBeChecked();
  });

  it("refuses a tab or a window and asks for the entire screen", async () => {
    devices({ screenSurface: "browser" });
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Share your entire screen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/You shared a tab or a window/);
    expect(screen.getByRole("button", { name: "Share your entire screen" })).toBeInTheDocument();
  });

  it("marks the entire screen and the camera as on", async () => {
    devices();
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Share your entire screen" }));
    await user.click(screen.getByRole("button", { name: "Turn on camera" }));

    expect(await screen.findByText("Sharing your entire screen.")).toBeInTheDocument();
    expect(await screen.findByLabelText("Your camera")).toBeInTheDocument();
  });

  it("says when a second screen is connected, and how to fix it", () => {
    devices();
    render(<Harness secondScreen />);

    expect(screen.getByText(/Use one screen/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/A second screen is connected\. Disconnect it, or set your displays to mirror/);
  });

  it("says how to fix a blocked camera", async () => {
    devices({ camera: false });
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Turn on camera" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Allow camera access/);
  });
});
