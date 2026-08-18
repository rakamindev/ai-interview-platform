import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { z } from "zod";

import CustomSkillForm from "./CustomSkillForm";
import { assessmentSchema } from "@/pages/assessments/assessmentSchema";
import { useEffect } from "react";

type FormValues = z.infer<typeof assessmentSchema>;

const defaultSkill = {
  skill_label: "",
  is_custom: true,
  expected_level: 3,
  display_order: 0,
  scope_include: "",
  l1_anchor: "",
  l2_anchor: "",
  l3_anchor: "",
  l4_anchor: "",
  l5_anchor: "",
};

const TestForm = ({
  onSubmit,
  errors,
}: {
  onSubmit?: (data: FormValues) => void;
  errors?: boolean;
}) => {
  const form = useForm<FormValues>({
    defaultValues: {
      name: "Test Assessment",
      time_limit_min: 45,
      language: "en",
      skills: [defaultSkill],
    },
  });

  useEffect(() => {
    if (!errors) {
      return;
    }

    form.setError("skills.0.skill_label", {
      type: "custom",
      message: "Skill name is required.",
    });

    form.setError("skills.0.scope_include", {
      type: "custom",
      message: "This field is required.",
    });
  }, [errors, form]);

  return (
    <form
      onSubmit={form.handleSubmit((data) => {
        onSubmit?.(data);
      })}
    >
      <CustomSkillForm
        index={0}
        form={form}
      />

      <button type="submit">Submit</button>
    </form>
  );
};

describe("CustomSkillForm", () => {
  it("renders all custom skill fields", () => {
    render(<TestForm />);

    expect(
      screen.getByLabelText(/name/i)
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/what counts \(scope include\)/i)
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/l1 anchor/i)
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/l2 anchor/i)
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/l3 anchor/i)
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/l4 anchor/i)
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/l5 anchor/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText("Expected level")
    ).toBeInTheDocument();
  });

  it("renders the expected level with the current value", () => {
    render(<TestForm />);

    expect(
      screen.getByRole("radio", { name: "L3" })
    ).toBeChecked();

    expect(
      screen.getByRole("radio", { name: "L1" })
    ).not.toBeChecked();
  });

  it("updates custom skill fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<TestForm onSubmit={onSubmit} />);

    await user.type(
      screen.getByLabelText(/name/i),
      "Communication"
    );

    await user.type(
      screen.getByLabelText(/what counts \(scope include\)/i),
      "Clear communication with stakeholders"
    );

    await user.type(
      screen.getByLabelText(/l1 anchor/i),
      "Basic communication"
    );

    await user.type(
      screen.getByLabelText(/l2 anchor/i),
      "Clear communication"
    );

    await user.type(
      screen.getByLabelText(/l3 anchor/i),
      "Effective communication"
    );

    await user.type(
      screen.getByLabelText(/l4 anchor/i),
      "Advanced communication"
    );

    await user.type(
      screen.getByLabelText(/l5 anchor/i),
      "Expert communication"
    );

    await user.click(
      screen.getByRole("radio", { name: "L4" })
    );

    await user.click(
      screen.getByRole("button", { name: "Submit" })
    );

    expect(onSubmit).toHaveBeenCalledTimes(1);

    const submittedData = onSubmit.mock.calls[0][0];

    expect(submittedData.skills[0]).toEqual(
      expect.objectContaining({
        skill_label: "Communication",
        scope_include:
          "Clear communication with stakeholders",
        l1_anchor: "Basic communication",
        l2_anchor: "Clear communication",
        l3_anchor: "Effective communication",
        l4_anchor: "Advanced communication",
        l5_anchor: "Expert communication",
        expected_level: 4,
      })
    );
  });

  it("displays validation errors", async () => {
    render(<TestForm errors />);

    await waitFor(() => {
      expect(
        screen.getByText("Skill name is required.")
      ).toBeInTheDocument();

      expect(
        screen.getByText("This field is required.")
      ).toBeInTheDocument();
    });
  });

  it("uses the correct placeholders for each anchor level", () => {
    render(<TestForm />);

    expect(
      screen.getByPlaceholderText(
        "What does L1 look like for this skill?"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(
        "What does L2 look like for this skill?"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(
        "What does L3 look like for this skill?"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(
        "What does L4 look like for this skill?"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(
        "What does L5 look like for this skill?"
      )
    ).toBeInTheDocument();
  });
});