import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OverrideForm from "./OverrideForm";
import type { PortfolioSkill } from "@/types";

// A plain function instead of vi.fn: Vitest 4 spies also observe the rejected
// promise and report it as unhandled even though the component catches it.
const api = vi.hoisted(() => ({
  calls: [] as unknown[][],
  respond: (() => Promise.resolve({})) as () => Promise<unknown>,
}));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    saveOverride: (...args: unknown[]) => {
      api.calls.push(args);
      return api.respond();
    },
  },
}));

const skill = {
  id: 42,
  skill_label: "RESTful API Design",
  is_discovered: false,
  ai_level: 3,
  ai_confidence: "high",
  evidence: [],
  competency_summary: "Ringkasan fiktif.",
  override_history: [],
} as unknown as PortfolioSkill;

const VALID_REASON = "Contoh versioning tidak menyebut klien nyata.";

function setup(currentLevel = 3) {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  render(<OverrideForm skill={skill} currentLevel={currentLevel} onSaved={onSaved} onCancel={onCancel} />);
  return { onSaved, onCancel, user: userEvent.setup() };
}

const saveButton = () => screen.getByRole("button", { name: /save correction/i });
const reasonBox = () => screen.getByRole("textbox", { name: /reason/i });

describe("OverrideForm", () => {
  beforeEach(() => {
    api.calls = [];
    api.respond = () => Promise.resolve({});
  });

  it("requires a reason: save stays disabled until it has at least 10 characters", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("radio", { name: "L2" }));

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("0/1000")).toBeInTheDocument();

    await user.type(reasonBox(), "123456789");
    expect(saveButton()).toBeDisabled();

    await user.type(reasonBox(), "0");
    expect(saveButton()).toBeEnabled();
  });

  it("ignores surrounding whitespace when counting the reason", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("radio", { name: "L2" }));
    await user.type(reasonBox(), "      abc      ");

    expect(saveButton()).toBeDisabled();
  });

  it("blocks saving the level that is already in effect", async () => {
    const { user } = setup(3);
    await user.type(reasonBox(), VALID_REASON);

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(/different from the current level \(L3\)/i)).toBeInTheDocument();
  });

  it("sends the level and reason, shows a saving state, and reports the result", async () => {
    let resolve!: (value: unknown) => void;
    api.respond = () => new Promise((r) => (resolve = r));
    const { user, onSaved } = setup();

    await user.click(screen.getByRole("radio", { name: "L2" }));
    await user.type(reasonBox(), VALID_REASON);
    await user.click(saveButton());

    expect(api.calls).toEqual([[42, { override_level: 2, assessor_notes: VALID_REASON }]]);
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    const override = { id: 1, portfolio_skill_id: 42, ai_level: 3, override_level: 2, assessor_notes: VALID_REASON };
    const event = { id: 9, previous_level: 3, new_level: 2, ai_level: 3, reason: VALID_REASON, actor_id: 7, legacy: false, created_at: "2026-11-06T14:43:00Z" };
    resolve({ data: { override, event } });

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(override, event));
  });

  it("shows the server's validation message and lets the assessor retry", async () => {
    api.respond = () =>
      Promise.reject({
        response: { status: 422, data: { errors: [{ status: 422, message: "Portfolio is not ready for overrides (status: generating)" }] } },
      });
    const { user, onSaved } = setup();

    await user.click(screen.getByRole("radio", { name: "L2" }));
    await user.type(reasonBox(), VALID_REASON);
    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Portfolio is not ready for overrides");
    expect(saveButton()).toBeEnabled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("explains timeouts and network errors without technical jargon", async () => {
    api.respond = () => Promise.reject({ code: "ECONNABORTED" });
    const { user } = setup();

    await user.click(screen.getByRole("radio", { name: "L2" }));
    await user.type(reasonBox(), VALID_REASON);
    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/check your connection/i);
  });
});
