import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSkillPicker } from "./useSkillPicker";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import type { SkillTaxonomy } from "@/types";
import type { SkillPickerProps } from "@/components/assessment/SkillPicker";

vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: {
    list: vi.fn(),
  },
}));

const mockedList = vi.mocked(skillTaxonomiesApi.list);

const skills: SkillTaxonomy[] = [
  {
    skill_id: "skill-1",
    skill_label: "React.js",
    category: "Frontend",
    scope_include: "React development",
    scope_exclude: "React Native",
    l1_anchor: "Frontend Development",
    l2_anchor: "React",
    l3_anchor: "Components",
    l4_anchor: "Hooks",
    l5_anchor: "Advanced Hooks",
  },
  {
    skill_id: "skill-2",
    skill_label: "TypeScript",
    category: "Frontend",
    scope_include: "Type-safe development",
    scope_exclude: "JavaScript fundamentals",
    l1_anchor: "Frontend Development",
    l2_anchor: "TypeScript",
    l3_anchor: "Types",
    l4_anchor: "Generics",
    l5_anchor: "Advanced Types",
  },
];

const createProps = (
  overrides: Partial<SkillPickerProps> = {}
): SkillPickerProps => ({
  open: false,
  onOpenChange: vi.fn(),
  onSelect: vi.fn(),
  ...overrides,
});

describe("useSkillPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not load skills when picker is closed", () => {
    const props = createProps({
      open: false,
    });

    renderHook(() => useSkillPicker(props));

    expect(mockedList).not.toHaveBeenCalled();
  });

  it("loads skills when picker is opened", async () => {
    mockedList.mockResolvedValue({
      data: {
        skill_taxonomies: skills,
      },
    } as never);

    const props = createProps({
      open: true,
    });

    const { result } = renderHook(() => useSkillPicker(props));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(false);
    expect(result.current.filtered).toEqual(skills);
    expect(mockedList).toHaveBeenCalledTimes(1);
  });

  it("handles API error", async () => {
    mockedList.mockRejectedValue(new Error("Network error"));

    const props = createProps({
      open: true,
    });

    const { result } = renderHook(() => useSkillPicker(props));

    await waitFor(() => {
      expect(result.current.error).toBe(true);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.filtered).toEqual([]);
    expect(mockedList).toHaveBeenCalledTimes(1);
  });

  it("clears error before retrying", async () => {
    mockedList.mockRejectedValueOnce(new Error("Network error"));

    const props = createProps({
      open: true,
    });

    const { result } = renderHook(() => useSkillPicker(props));

    await waitFor(() => {
      expect(result.current.error).toBe(true);
    });

    mockedList.mockResolvedValueOnce({
      data: {
        skill_taxonomies: skills,
      },
    } as never);

    await act(async () => {
      await result.current.getSkills();
    });

    expect(result.current.error).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.filtered).toEqual(skills);
    expect(mockedList).toHaveBeenCalledTimes(2);
  });

  it("returns empty list when API returns no skills", async () => {
    mockedList.mockResolvedValue({
      data: {
        skill_taxonomies: [],
      },
    } as never);

    const props = createProps({
      open: true,
    });

    const { result } = renderHook(() => useSkillPicker(props));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(false);
    expect(result.current.filtered).toEqual([]);
  });

  it("filters skills by query", async () => {
    mockedList.mockResolvedValue({
      data: {
        skill_taxonomies: skills,
      },
    } as never);

    const props = createProps({
      open: true,
    });

    const { result } = renderHook(() => useSkillPicker(props));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setQuery("react");
    });

    expect(result.current.filtered).toEqual([skills[0]]);
  });

  it("filters skills case-insensitively", async () => {
    mockedList.mockResolvedValue({
      data: {
        skill_taxonomies: skills,
      },
    } as never);

    const props = createProps({
      open: true,
    });

    const { result } = renderHook(() => useSkillPicker(props));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setQuery("TYPESCRIPT");
    });

    expect(result.current.filtered).toEqual([skills[1]]);
  });

  it("returns empty result when query does not match", async () => {
    mockedList.mockResolvedValue({
      data: {
        skill_taxonomies: skills,
      },
    } as never);

    const props = createProps({
      open: true,
    });

    const { result } = renderHook(() => useSkillPicker(props));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setQuery("Vue");
    });

    expect(result.current.filtered).toEqual([]);
  });

  it("selects a skill and closes the picker", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    const props = createProps({
      open: false,
      onSelect,
      onOpenChange,
    });

    const { result } = renderHook(() => useSkillPicker(props));

    act(() => {
      result.current.handleSelect(skills[0]);
    });

    expect(onSelect).toHaveBeenCalledWith({
      skill_id: undefined,
      skill_label: "React.js",
      is_custom: false,
      expected_level: 3,
      scope_include: "React development",
      l1_anchor: "Frontend Development",
      l2_anchor: "React",
      l3_anchor: "Components",
      l4_anchor: "Hooks",
      l5_anchor: "Advanced Hooks",
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(result.current.query).toBe("");
  });
});