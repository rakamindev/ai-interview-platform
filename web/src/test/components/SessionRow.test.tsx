import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SessionRow from "@/components/assessor/SessionRow";
import type { Session } from "@/types";

const baseSession = (over: Partial<Session> = {}): Session =>
  ({
    id: 10,
    status: "ended",
    end_reason: "all_covered",
    candidate_name: "Budi",
    invite_url: "https://example.com/interview/tok",
    ...over,
  }) as Session;

function renderRow(session: Session, props: Partial<{ onDeleted: (id: number) => void }> = {}) {
  return render(
    <MemoryRouter>
      <SessionRow
        session={session}
        index={1}
        assessmentId="3"
        onCopy={vi.fn()}
        copiedId={null}
        onDeleted={props.onDeleted ?? vi.fn()}
      />
    </MemoryRouter>
  );
}

describe("SessionRow — UU PDP delete button visibility", () => {
  it("shows the delete button for ended sessions", () => {
    renderRow(baseSession());
    expect(screen.getByRole("button", { name: /Delete Budi/ })).toBeInTheDocument();
  });

  it.each([
    ["active"],
    ["pending"],
  ])("hides the delete button for %s sessions", (status) => {
    renderRow(baseSession({ status: status as Session["status"], ended_at: undefined }));
    expect(screen.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
  });
});

describe("SessionRow — delete confirmation flow", () => {
  it("requires confirmation before deleting", async () => {
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    renderRow(baseSession(), { onDeleted });

    await user.click(screen.getByRole("button", { name: /Delete Budi/ }));

    // Confirmation dialog appears and names the candidate + data scope
    expect(await screen.findByText("Delete this session?")).toBeInTheDocument();
    expect(screen.getByText(/permanently removes Budi's interview data/i)).toBeInTheDocument();

    // Nothing deleted until confirmed
    expect(onDeleted).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect(onDeleted).toHaveBeenCalledWith(10);
  });

  it("does not delete when cancelled", async () => {
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    renderRow(baseSession(), { onDeleted });

    await user.click(screen.getByRole("button", { name: /Delete Budi/ }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("mentions failed sessions in the dialog too (they are deletable)", () => {
    renderRow(baseSession({ end_reason: "error" }));
    expect(screen.getByRole("button", { name: /Delete Budi/ })).toBeInTheDocument();
  });
});
