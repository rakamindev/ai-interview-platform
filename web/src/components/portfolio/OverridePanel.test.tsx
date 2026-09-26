import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OverridePanel from "./OverridePanel";
import { MAX_ASSESSOR_NOTES } from "@/utils/constants";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: { getOverride: vi.fn() } }));

const skill: any = { id: 1, skill_label: "React", ai_level: 3, status: "assessed", ai_confidence: "high", evidence: [], competency_summary: "ok" };

async function openPanel(existing?: any) {
  render(<OverridePanel skill={skill} existingOverride={existing} onSaved={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: /override/i }));
}

// The API rejects notes over 2000 characters (422); the form must enforce the same
// limit up front instead of failing with a generic "could not save".
describe("OverridePanel notes limit", () => {
  it("caps the notes field at the API limit", async () => {
    await openPanel();

    expect(screen.getByRole("textbox")).toHaveAttribute("maxLength", String(MAX_ASSESSOR_NOTES));
  });

  it("shows a live character counter", async () => {
    await openPanel();
    await userEvent.type(screen.getByRole("textbox"), "hello");

    expect(screen.getByText(`5 / ${MAX_ASSESSOR_NOTES}`)).toBeInTheDocument();
  });

  it("blocks saving legacy notes that are already over the limit", async () => {
    await openPanel({ id: 1, override_level: 4, assessor_notes: "x".repeat(MAX_ASSESSOR_NOTES + 500) });

    expect(screen.getByRole("button", { name: /simpan perubahan/i })).toBeDisabled();
    expect(screen.getByText(/terlalu panjang/i)).toBeInTheDocument();
  });
});
