import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LiveCaptionsOverlay from "../LiveCaptionsOverlay";

describe("LiveCaptionsOverlay", () => {
  it("renders null when disabled or latestTurn is missing", () => {
    const { container: disabledContainer } = render(
      <LiveCaptionsOverlay latestTurn={{ speaker: "ai", text: "Hello" }} enabled={false} />
    );
    expect(disabledContainer.firstChild).toBeNull();

    const { container: emptyContainer } = render(
      <LiveCaptionsOverlay latestTurn={null} enabled={true} />
    );
    expect(emptyContainer.firstChild).toBeNull();
  });

  it("renders AI subtitle with AI badge", () => {
    render(
      <LiveCaptionsOverlay
        latestTurn={{ speaker: "ai", text: "Could you walk me through your Kafka setup?" }}
        enabled={true}
      />
    );

    expect(screen.getByText("AI:")).toBeInTheDocument();
    expect(screen.getByText("Could you walk me through your Kafka setup?")).toBeInTheDocument();
  });

  it("renders candidate subtitle with You badge", () => {
    render(
      <LiveCaptionsOverlay
        latestTurn={{ speaker: "candidate", text: "We partitioned by customer ID." }}
        enabled={true}
      />
    );

    expect(screen.getByText("You:")).toBeInTheDocument();
    expect(screen.getByText("We partitioned by customer ID.")).toBeInTheDocument();
  });
});
