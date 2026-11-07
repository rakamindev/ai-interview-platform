import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OverrideHistory from "./OverrideHistory";
import type { OverrideEvent } from "@/types";

const event = (overrides: Partial<OverrideEvent>): OverrideEvent => ({
  id: 1,
  previous_level: 3,
  new_level: 2,
  ai_level: 3,
  reason: "Alasan fiktif yang cukup panjang.",
  actor_id: 7,
  legacy: false,
  created_at: "2026-11-06T14:43:00Z",
  ...overrides,
});

describe("OverrideHistory", () => {
  it("explains the empty state: the level is still the AI rating", () => {
    render(<OverrideHistory events={[]} />);

    expect(screen.getByText(/no human corrections yet/i)).toBeInTheDocument();
  });

  it("lists every correction in the given order with levels, reason, assessor and WIB time", () => {
    render(
      <OverrideHistory
        events={[
          event({ id: 2, previous_level: 2, new_level: 1, reason: "Koreksi kedua.", created_at: "2026-11-06T15:00:00Z" }),
          event({ id: 1, reason: "Koreksi pertama." }),
        ]}
      />
    );

    const items = within(screen.getByRole("list", { name: /correction history/i })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("L2");
    expect(items[0]).toHaveTextContent("L1");
    expect(items[0]).toHaveTextContent("Koreksi kedua.");
    expect(items[1]).toHaveTextContent("Koreksi pertama.");
    expect(items[1]).toHaveTextContent("Assessor #7");
    expect(items[1]).toHaveTextContent(/21[.:]43/);
    expect(items[1]).toHaveTextContent("WIB");
  });

  it("labels corrections that were made before reasons were required", () => {
    render(<OverrideHistory events={[event({ legacy: true, reason: null })]} />);

    expect(screen.getByText(/no reason recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/before reasons were required/i)).toBeInTheDocument();
  });

  it("shows the latest three and reveals the rest on request", async () => {
    const many = [5, 4, 3, 2, 1].map((id) => event({ id, reason: `Koreksi nomor ${id}.` }));
    render(<OverrideHistory events={many} />);

    const list = () => within(screen.getByRole("list", { name: /correction history/i }));
    expect(list().getAllByRole("listitem")).toHaveLength(3);

    await userEvent.setup().click(screen.getByRole("button", { name: /show all 5/i }));
    expect(list().getAllByRole("listitem")).toHaveLength(5);
  });

  it("wraps very long reasons instead of overflowing the card", () => {
    const longReason = "a".repeat(1000);
    render(<OverrideHistory events={[event({ reason: longReason })]} />);

    expect(screen.getByText(longReason)).toHaveClass("break-words");
  });
});
