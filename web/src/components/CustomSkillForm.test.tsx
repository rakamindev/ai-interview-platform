import { useForm } from "react-hook-form";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AssessmentFormValues } from "@/pages/assessments/AssessmentNewPage";
import CustomSkillForm from "./assessment/CustomSkillForm";

function TestForm() {
  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "Frontend Engineer",
      time_limit_min: 45,
      language: "en",
      skills: [
        {
          skill_label: "",
          is_custom: true,
          scope_include: "",
          l1_anchor: "",
          l2_anchor: "",
          l3_anchor: "",
          l4_anchor: "",
          l5_anchor: "",
          expected_level: 3,
          display_order: 0,
        },
      ],
    },
  });

  const onSubmit = vi.fn();

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <CustomSkillForm index={0} form={form} />

      <button type="submit">
        Save
      </button>
    </form>
  );
}

describe("CustomSkillForm", () => {
  it("menampilkan error pada required custom skill yang kosong", async () => {
    const user = userEvent.setup();

    render(<TestForm />);

    await user.click(
      screen.getByRole("button", {
        name: "Save",
      })
    );

    expect(
      await screen.findByText("Skill name is required")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Scope include is required")
    ).toBeInTheDocument();

    expect(
      screen.getByText("L1 anchor is required")
    ).toBeInTheDocument();

    expect(
      screen.getByText("L2 anchor is required")
    ).toBeInTheDocument();

    expect(
      screen.getByText("L3 anchor is required")
    ).toBeInTheDocument();

    expect(
      screen.getByText("L4 anchor is required")
    ).toBeInTheDocument();

    expect(
      screen.getByText("L5 anchor is required")
    ).toBeInTheDocument();
  });
});