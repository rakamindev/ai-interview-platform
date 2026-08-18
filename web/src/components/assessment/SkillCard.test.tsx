import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { z } from "zod";

import SkillCard from "./SkillCard";
import { assessmentSchema } from "@/pages/assessments/assessmentSchema";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => undefined),
    },
  },
}));

type FormValues = z.infer<typeof assessmentSchema>;

const createForm = (
  skill: FormValues["skills"][number]
) => {
  const TestForm = () => {
    const form = useForm<FormValues>({
      defaultValues: {
        name: "Test Assessment",
        time_limit_min: 45,
        language: "en",
        skills: [skill],
      },
    });

    return (
      <SkillCard
        index={0}
        id="skill-1"
        form={form}
        onRemove={vi.fn()}
      />
    );
  };

  return TestForm;
};

const b7Skill: FormValues["skills"][number] = {
  skill_id: 123,
  skill_label: "React",
  is_custom: false,
  expected_level: 3,
  display_order: 0,
  scope_include: "React development",
  l1_anchor: "Basic React",
  l2_anchor: "Intermediate React",
  l3_anchor: "Advanced React",
  l4_anchor: "Expert React",
  l5_anchor: "Master React",
};

const customSkill: FormValues["skills"][number] = {
  skill_label: "Communication",
  is_custom: true,
  expected_level: 3,
  display_order: 0,
  scope_include: "Clear communication",
  l1_anchor: "Basic",
  l2_anchor: "Intermediate",
  l3_anchor: "Advanced",
  l4_anchor: "Expert",
  l5_anchor: "Master",
};

describe("SkillCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a B7 skill", () => {
    const TestForm = createForm(b7Skill);

    render(<TestForm />);

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("SK-123")).toBeInTheDocument();
    expect(
      screen.getByText("Show L1–L5 anchors")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Expected level:")
    ).toBeInTheDocument();
  });

  it("renders custom skill", () => {
    const TestForm = createForm(customSkill);

    render(<TestForm />);

    expect(
      screen.getByText("Communication")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Custom")
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/name/i)
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(
        /what counts \(scope include\)/i
      )
    ).toBeInTheDocument();
  });

  it("shows and hides B7 anchors", async () => {
    const user = userEvent.setup();

    const TestForm = createForm(b7Skill);

    render(<TestForm />);

    expect(
      screen.queryByText("Basic React")
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /show l1–l5 anchors/i,
      })
    );

    expect(
      screen.getByText("Basic React")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Intermediate React")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Advanced React")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Expert React")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Master React")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /hide l1–l5 anchors/i,
      })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /hide l1–l5 anchors/i,
      })
    );

    expect(
      screen.queryByText("Basic React")
    ).not.toBeInTheDocument();
  });

  it("renders the expected level for B7 skill", () => {
    const TestForm = createForm({
      ...b7Skill,
      expected_level: 4,
    });

    render(<TestForm />);

    expect(
      screen.getByRole("radio", { name: "L4" })
    ).toBeChecked();

    expect(
      screen.getByRole("radio", { name: "L3" })
    ).not.toBeChecked();
  });

  it("updates expected level for B7 skill", async () => {
    const user = userEvent.setup();

    const TestForm = createForm(b7Skill);

    render(<TestForm />);

    await user.click(
      screen.getByRole("radio", { name: "L5" })
    );

    expect(
      screen.getByRole("radio", { name: "L5" })
    ).toBeChecked();
  });

  it("calls onRemove when remove button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    const TestForm = () => {
      const form = useForm<FormValues>({
        defaultValues: {
          name: "Test Assessment",
          time_limit_min: 45,
          language: "en",
          skills: [b7Skill],
        },
      });

      return (
        <SkillCard
          index={0}
          id="skill-1"
          form={form}
          onRemove={onRemove}
        />
      );
    };

    render(<TestForm />);

    await user.click(
      screen.getByRole("button", {
        name: "Remove skill",
      })
    );

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("shows New Skill when skill label is empty", () => {
    const TestForm = createForm({
      ...b7Skill,
      skill_label: "",
    });

    render(<TestForm />);

    expect(
      screen.getByText("New Skill")
    ).toBeInTheDocument();
  });

  it("shows custom skill form instead of B7 anchors", () => {
    const TestForm = createForm(customSkill);

    render(<TestForm />);

    expect(
      screen.queryByText("Show L1–L5 anchors")
    ).not.toBeInTheDocument();

    expect(
      screen.getByLabelText(/name/i)
    ).toBeInTheDocument();
  });

  it("applies dragging state", async () => {
    const { useSortable } = await import("@dnd-kit/sortable");

    vi.mocked(useSortable).mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: true,
    } as never);

    const TestForm = createForm(b7Skill);

    const { container } = render(<TestForm />);

    const card = container.firstElementChild;

    expect(card).toHaveClass("opacity-50");
    expect(card).toHaveClass("shadow-lg");
  });
});