import { describe, it, expect, vi } from "vite-plus/test";
import { render, screen, fireEvent } from "@testing-library/react";
import { useForm } from "react-hook-form";
import type { ReactNode } from "react";
import SkillCard from "./SkillCard";
import type { AssessmentFormValues } from "@/pages/assessments/AssessmentNewPage";

function Harness({
  skill,
  children,
}: {
  skill: Partial<AssessmentFormValues["skills"][number]>;
  children: (form: ReturnType<typeof useForm<AssessmentFormValues>>) => ReactNode;
}) {
  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "Test",
      time_limit_min: 30,
      language: "en",
      skills: [{ skill_label: "", is_custom: true, expected_level: 3, display_order: 0, ...skill }],
    },
  });
  return children(form);
}

describe("SkillCard", () => {
  it("shows the skill label and its taxonomy id for library skills", () => {
    render(
      <Harness skill={{ skill_label: "React", is_custom: false, skill_id: 12 }}>
        {(form) => <SkillCard index={0} id="s1" form={form} onRemove={vi.fn()} />}
      </Harness>,
    );
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("SK-012")).toBeInTheDocument();
  });

  it("falls back to a placeholder label for unnamed skills", () => {
    render(
      <Harness skill={{ is_custom: true }}>
        {(form) => <SkillCard index={0} id="s1" form={form} onRemove={vi.fn()} />}
      </Harness>,
    );
    expect(screen.getByText("New Skill")).toBeInTheDocument();
  });

  it("marks custom skills and renders the custom form", () => {
    render(
      <Harness skill={{ is_custom: true, skill_label: "Design" }}>
        {(form) => <SkillCard index={0} id="s1" form={form} onRemove={vi.fn()} />}
      </Harness>,
    );
    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
  });

  it("toggles the anchors panel for library skills", () => {
    render(
      <Harness
        skill={{ is_custom: false, skill_label: "React", l3_anchor: "Builds maintainable UIs" }}
      >
        {(form) => <SkillCard index={0} id="s1" form={form} onRemove={vi.fn()} />}
      </Harness>,
    );
    expect(screen.queryByText(/Builds maintainable UIs/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Show L1–L5 anchors"));
    expect(screen.getByText(/Builds maintainable UIs/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Hide L1–L5 anchors"));
    expect(screen.queryByText(/Builds maintainable UIs/)).not.toBeInTheDocument();
  });

  it("fires onRemove when the remove button is pressed", () => {
    const onRemove = vi.fn();
    render(
      <Harness skill={{ is_custom: true }}>
        {(form) => <SkillCard index={0} id="s1" form={form} onRemove={onRemove} />}
      </Harness>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove skill" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("updates the expected level for library skills", () => {
    render(
      <Harness skill={{ is_custom: false, skill_label: "React", expected_level: 3 }}>
        {(form) => <SkillCard index={0} id="s1" form={form} onRemove={vi.fn()} />}
      </Harness>,
    );
    const l5 = screen.getByRole("radio", { name: "L5" });
    fireEvent.click(l5);
    expect(l5).toBeChecked();
  });
});
