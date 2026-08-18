import { render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import SkillCard from "@/components/assessment/SkillCard";
import type { AssessmentFormValues } from "@/pages/assessments/AssessmentNewPage";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

function renderSkillCard(
  skill: Partial<AssessmentFormValues["skills"][number]>,
) {
  const { result } = renderHook(() =>
    useForm<AssessmentFormValues>({
      defaultValues: { name: "", role_title: "", skills: [skill] } as never,
    }),
  );

  render(
    <SkillCard
      index={0}
      id='skill-1'
      form={result.current}
      onRemove={() => {}}
    />,
  );
}

describe("SkillCard — custom skill accordion", () => {
  it("does not show a collapse toggle for a taxonomy (non-custom) skill", () => {
    renderSkillCard({
      skill_label: "RESTful API Design",
      skill_id: 5,
      expected_level: 4,
      is_custom: false,
    });

    expect(
      screen.queryByRole("button", { name: /collapse custom skill details/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /expand custom skill details/i }),
    ).not.toBeInTheDocument();
  });

  it("starts expanded for a custom skill, showing the full form", () => {
    renderSkillCard({
      skill_label: "Communication",
      is_custom: true,
      expected_level: 3,
    });

    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what counts/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /collapse custom skill details/i }),
    ).toBeInTheDocument();
  });

  it("collapses to the expected-level block a taxonomy skill shows, not an empty card", async () => {
    const user = userEvent.setup();
    renderSkillCard({
      skill_label: "Communication",
      is_custom: true,
      expected_level: 3,
    });

    await user.click(
      screen.getByRole("button", { name: /collapse custom skill details/i }),
    );

    expect(screen.queryByLabelText(/^name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/what counts/i)).not.toBeInTheDocument();
    // The skill's name stays visible in the header even while collapsed.
    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByText(/expected level/i)).toBeInTheDocument();
    // No anchors have been filled in yet — the toggle would open onto an empty box, so it's hidden.
    expect(screen.queryByText(/show l1–l5 anchors/i)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /expand custom skill details/i }),
    );

    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what counts/i)).toBeInTheDocument();
    expect(screen.queryByText(/show l1–l5 anchors/i)).not.toBeInTheDocument();
  });

  it("shows the user's own filled-in anchor text when collapsed (not taxonomy reference text)", async () => {
    const user = userEvent.setup();
    renderSkillCard({
      skill_label: "Communication",
      is_custom: true,
      expected_level: 3,
      l1_anchor: "Struggles to explain basic ideas",
    });

    await user.click(
      screen.getByRole("button", { name: /collapse custom skill details/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /show l1–l5 anchors/i }),
    );

    expect(
      screen.getByText("Struggles to explain basic ideas"),
    ).toBeInTheDocument();
  });
});
