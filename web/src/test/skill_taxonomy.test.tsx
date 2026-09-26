import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import SkillCard from "@/components/assessment/SkillCard";
import CustomSkillDialog from "@/components/assessment/CustomSkillDialog";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import type { AssessmentFormValues } from "@/pages/assessments/AssessmentNewPage";
import type { SkillTaxonomy } from "@/types";

const mockTaxonomySkills: SkillTaxonomy[] = [
  {
    skill_id: "SK-ENG-001",
    skill_label: "React Frontend Core",
    category: "engineering",
    scope_include: "Component design and state management",
    scope_exclude: "Backend APIs",
    l1_anchor: "Basic JSX components",
    l2_anchor: "Independent features",
    l3_anchor: "Complex end-to-end design",
    l4_anchor: "Team standards",
    l5_anchor: "Org architecture",
  },
  {
    skill_id: "SK-SOFT-001",
    skill_label: "Technical Communication",
    category: "soft_skills",
    scope_include: "Cross-team alignment",
    scope_exclude: "Public relations",
    l1_anchor: "Communicates when prompted",
    l2_anchor: "Clear updates within team",
    l3_anchor: "Proactive cross-team alignment",
    l4_anchor: "Cross-functional consensus driver",
    l5_anchor: "Executive communication leadership",
  },
];

function SkillCardTestWrapper({
  initialSkill,
  onRemove = vi.fn(),
  onEdit = vi.fn(),
}: {
  initialSkill: AssessmentFormValues["skills"][0];
  onRemove?: () => void;
  onEdit?: () => void;
}) {
  const form = useForm<AssessmentFormValues>({
    defaultValues: {
      name: "Test Assessment",
      time_limit_min: 30,
      language: "en",
      skills: [initialSkill],
    },
  });

  return (
    <DndContext>
      <SortableContext items={["test-skill-1"]}>
        <SkillCard
          index={0}
          id="test-skill-1"
          form={form}
          onRemove={onRemove}
          onEdit={onEdit}
        />
      </SortableContext>
    </DndContext>
  );
}

describe("LevelRadio", () => {
  it("renders radio buttons with scoped IDs from idPrefix", () => {
    const onChange = vi.fn();
    render(
      <LevelRadio
        value={3}
        onChange={onChange}
        idPrefix="assessment-skill-0"
      />
    );

    for (let level = 1; level <= 5; level++) {
      const radio = screen.getByRole("radio", {
        name: new RegExp(`^L${level}`),
      });
      expect(radio).toHaveAttribute("id", `assessment-skill-0-${level}`);
    }
  });

  it("calls onChange with selected level when clicked", () => {
    const onChange = vi.fn();
    render(
      <LevelRadio
        value={2}
        onChange={onChange}
        idPrefix="row-0"
      />
    );

    const level4Radio = screen.getByRole("radio", { name: /^L4/ });
    fireEvent.click(level4Radio);
    expect(onChange).toHaveBeenCalledWith(4);
  });
});

describe("SkillPicker", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and renders B7 taxonomy skills with categories and no raw ID badges", async () => {
    vi.spyOn(skillTaxonomiesApi, "list").mockResolvedValue({
      data: { skill_taxonomies: mockTaxonomySkills },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {} as any,
    });

    render(
      <SkillPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("React Frontend Core")).toBeInTheDocument();
      expect(screen.getByText("Technical Communication")).toBeInTheDocument();
      expect(screen.getAllByText(/engineering/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/soft skills/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("SK-ENG-001")).not.toBeInTheDocument();
    });
  });

  it("filters skills by category tabs", async () => {
    vi.spyOn(skillTaxonomiesApi, "list").mockResolvedValue({
      data: { skill_taxonomies: mockTaxonomySkills },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {} as any,
    });

    render(
      <SkillPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("React Frontend Core")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^Soft Skills$/i }));
    expect(screen.queryByText("React Frontend Core")).not.toBeInTheDocument();
    expect(screen.getByText("Technical Communication")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Engineering$/i }));
    expect(screen.getByText("React Frontend Core")).toBeInTheDocument();
    expect(screen.queryByText("Technical Communication")).not.toBeInTheDocument();
  });

  it("filters skills by search query", async () => {
    vi.spyOn(skillTaxonomiesApi, "list").mockResolvedValue({
      data: { skill_taxonomies: mockTaxonomySkills },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {} as any,
    });

    render(
      <SkillPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("React Frontend Core")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by skill name/i);
    fireEvent.change(searchInput, { target: { value: "Technical" } });

    expect(screen.queryByText("React Frontend Core")).not.toBeInTheDocument();
    expect(screen.getByText("Technical Communication")).toBeInTheDocument();
  });

  it("toggles detail preview drawer displaying exclusions and anchors", async () => {
    vi.spyOn(skillTaxonomiesApi, "list").mockResolvedValue({
      data: { skill_taxonomies: mockTaxonomySkills },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {} as any,
    });

    render(
      <SkillPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("React Frontend Core")).toBeInTheDocument();
    });

    const detailButtons = screen.getAllByRole("button", { name: /preview details/i });
    fireEvent.click(detailButtons[0]);

    expect(screen.queryByText(/excludes:/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Backend APIs")).not.toBeInTheDocument();
    expect(screen.getByText("Basic JSX components")).toBeInTheDocument();
    expect(screen.getByText("Org architecture")).toBeInTheDocument();

    const hideButton = screen.getByRole("button", { name: /hide details/i });
    fireEvent.click(hideButton);

    expect(screen.queryByText("Basic JSX components")).not.toBeInTheDocument();
  });

  it("calls onSelect with B7 skill_id and full anchor payload", async () => {
    vi.spyOn(skillTaxonomiesApi, "list").mockResolvedValue({
      data: { skill_taxonomies: mockTaxonomySkills },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {} as any,
    });

    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <SkillPicker
        open={true}
        onOpenChange={onOpenChange}
        onSelect={onSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("React Frontend Core")).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole("button", { name: /add/i });
    fireEvent.click(addButtons[0]);

    expect(onSelect).toHaveBeenCalledWith({
      skill_id: "SK-ENG-001",
      skill_label: "React Frontend Core",
      is_custom: false,
      expected_level: 3,
      scope_include: "Component design and state management",
      scope_exclude: "Backend APIs",
      l1_anchor: "Basic JSX components",
      l2_anchor: "Independent features",
      l3_anchor: "Complex end-to-end design",
      l4_anchor: "Team standards",
      l5_anchor: "Org architecture",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("renders disabled Added button when skill is already present in existingSkillIds", async () => {
    vi.spyOn(skillTaxonomiesApi, "list").mockResolvedValue({
      data: { skill_taxonomies: mockTaxonomySkills },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {} as never,
    });

    const onSelect = vi.fn();

    render(
      <SkillPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelect={onSelect}
        existingSkillIds={["SK-ENG-001"]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("React Frontend Core")).toBeInTheDocument();
    });

    const addedButton = screen.getByRole("button", { name: /added/i });
    expect(addedButton).toBeDisabled();

    fireEvent.click(addedButton);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("SkillCard", () => {
  it("renders taxonomy skill without raw ID badge and toggles details", () => {
    render(
      <SkillCardTestWrapper
        initialSkill={{
          skill_id: "SK-ENG-001",
          skill_label: "React Frontend Core",
          is_custom: false,
          expected_level: 3,
          l1_anchor: "Foundational JSX",
          l2_anchor: "Functional code",
          l3_anchor: "Proficient architecture",
          l4_anchor: "Advanced patterns",
          l5_anchor: "Expert leadership",
        }}
      />
    );

    expect(screen.getByText("React Frontend Core")).toBeInTheDocument();
    expect(screen.queryByText("SK-ENG-001")).not.toBeInTheDocument();
    expect(screen.queryByText("Custom")).not.toBeInTheDocument();

    const toggleButton = screen.getByRole("button", { name: /^detail$/i });
    fireEvent.click(toggleButton);

    expect(screen.getByText("Foundational JSX")).toBeInTheDocument();
    expect(screen.getByText("Expert leadership")).toBeInTheDocument();
  });

  it("renders Custom badge and edit trigger for custom skills", () => {
    const onEdit = vi.fn();
    render(
      <SkillCardTestWrapper
        initialSkill={{
          skill_id: undefined,
          skill_label: "Proprietary Architecture",
          is_custom: true,
          expected_level: 4,
          l1_anchor: "Basic",
          l2_anchor: "Intermediate",
          l3_anchor: "Advanced",
          l4_anchor: "Lead",
          l5_anchor: "Master",
        }}
        onEdit={onEdit}
      />
    );

    expect(screen.getByText("Proprietary Architecture")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();

    const editButton = screen.getByRole("button", { name: /edit custom skill/i });
    fireEvent.click(editButton);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onRemove when clicking delete button", () => {
    const onRemove = vi.fn();
    render(
      <SkillCardTestWrapper
        initialSkill={{
          skill_id: "SK-ENG-001",
          skill_label: "React Frontend Core",
          is_custom: false,
          expected_level: 3,
        }}
        onRemove={onRemove}
      />
    );

    const removeButton = screen.getByRole("button", { name: /remove skill/i });
    fireEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("CustomSkillDialog", () => {
  it("validates required fields before calling onSave", () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CustomSkillDialog
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />
    );

    const submitButton = screen.getByRole("button", { name: /add skill/i });
    fireEvent.click(submitButton);

    expect(screen.getByText("Skill name is required")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    const nameInput = screen.getByLabelText(/skill name/i);
    fireEvent.change(nameInput, { target: { value: "Security Compliance" } });
    fireEvent.click(submitButton);

    expect(screen.getByText(/all 5 level anchors/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("submits complete custom skill payload and closes dialog", () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CustomSkillDialog
        open={true}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByLabelText(/skill name/i), {
      target: { value: "Security Compliance" },
    });
    fireEvent.change(screen.getByLabelText(/what counts/i), {
      target: { value: "SOC2 and ISO standards" },
    });
    fireEvent.change(screen.getByLabelText(/level 1 anchor/i), {
      target: { value: "Knows basic terms" },
    });
    fireEvent.change(screen.getByLabelText(/level 2 anchor/i), {
      target: { value: "Follows checklists" },
    });
    fireEvent.change(screen.getByLabelText(/level 3 anchor/i), {
      target: { value: "Implements controls" },
    });
    fireEvent.change(screen.getByLabelText(/level 4 anchor/i), {
      target: { value: "Audits team processes" },
    });
    fireEvent.change(screen.getByLabelText(/level 5 anchor/i), {
      target: { value: "Leads security certifications" },
    });

    const submitButton = screen.getByRole("button", { name: /add skill/i });
    fireEvent.click(submitButton);

    expect(onSave).toHaveBeenCalledWith({
      skill_id: undefined,
      skill_label: "Security Compliance",
      is_custom: true,
      scope_include: "SOC2 and ISO standards",
      l1_anchor: "Knows basic terms",
      l2_anchor: "Follows checklists",
      l3_anchor: "Implements controls",
      l4_anchor: "Audits team processes",
      l5_anchor: "Leads security certifications",
      expected_level: 3,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
