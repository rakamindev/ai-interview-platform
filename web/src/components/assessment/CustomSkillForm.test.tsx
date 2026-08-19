import { describe, it, expect } from "vite-plus/test";
import { render, screen, fireEvent } from "@testing-library/react";
import { useForm } from "react-hook-form";
import type { ReactNode } from "react";
import CustomSkillForm from "./CustomSkillForm";
import type { AssessmentFormValues } from "@/pages/assessments/AssessmentNewPage";

function Harness({
  children,
}: {
  children: (form: ReturnType<typeof useForm<AssessmentFormValues>>) => ReactNode;
}) {
  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "Test",
      time_limit_min: 30,
      language: "en",
      skills: [{ skill_label: "", is_custom: true, expected_level: 3, display_order: 0 }],
    },
  });
  return children(form);
}

describe("CustomSkillForm", () => {
  it("renders the required fields for a custom skill", () => {
    render(<Harness>{(form) => <CustomSkillForm index={0} form={form} />}</Harness>);
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/What counts/)).toBeInTheDocument();
    expect(screen.getByText("L1 anchor")).toBeInTheDocument();
    expect(screen.getByText("L5 anchor")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("What does L3 look like for this skill?"),
    ).toBeInTheDocument();
  });

  it("registers typed values into the form state", () => {
    let formRef: ReturnType<typeof useForm<AssessmentFormValues>> | undefined;
    render(
      <Harness>
        {(form) => {
          formRef = form;
          return <CustomSkillForm index={0} form={form} />;
        }}
      </Harness>,
    );
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Storytelling" } });
    fireEvent.change(screen.getByLabelText(/What counts/), {
      target: { value: "Clear narrative arc" },
    });
    fireEvent.change(screen.getByPlaceholderText("What does L1 look like for this skill?"), {
      target: { value: "Can tell a story" },
    });
    expect(formRef!.getValues("skills.0.skill_label")).toBe("Storytelling");
    expect(formRef!.getValues("skills.0.scope_include")).toBe("Clear narrative arc");
    expect(formRef!.getValues("skills.0.l1_anchor")).toBe("Can tell a story");
  });

  it("updates the expected level through the radio group", () => {
    let formRef: ReturnType<typeof useForm<AssessmentFormValues>> | undefined;
    render(
      <Harness>
        {(form) => {
          formRef = form;
          return <CustomSkillForm index={0} form={form} />;
        }}
      </Harness>,
    );
    expect(formRef!.getValues("skills.0.expected_level")).toBe(3);
    fireEvent.click(screen.getByLabelText("L5"));
    expect(formRef!.getValues("skills.0.expected_level")).toBe(5);
  });
});
