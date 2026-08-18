import React from "react";
import axios from "axios";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { assessmentsApi } from "@/services/assessments";
import type { AssessmentSkill } from "@/types";
import { assessmentSchema } from "@/pages/assessments/assessmentSchema";

export const useAssessmentNewPage = () => {
  const navigate = useNavigate();

  const [submitting, setSubmitting] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof assessmentSchema>>({
    resolver: zodResolver(assessmentSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      time_limit_min: 45,
      language: "en",
      skills: [],
    },
  });

  const {
    handleSubmit,
    control,
    setValue,
    watch,
  } = form;

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "skills",
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = fields.findIndex(
        (field) => field.id === active.id
      );
      const newIndex = fields.findIndex(
        (field) => field.id === over.id
      );

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      move(oldIndex, newIndex);
    },
    [fields, move]
  );

  const addCustomSkill = React.useCallback(() => {
    append({
      skill_label: "",
      is_custom: true,
      expected_level: 3,
      display_order: fields.length,
      scope_include: "",
      scope_exclude: "",
      l1_anchor: "",
      l2_anchor: "",
      l3_anchor: "",
      l4_anchor: "",
      l5_anchor: "",
    });
  }, [append, fields.length]);

  const addB7Skill = React.useCallback(
    (skill: Partial<AssessmentSkill>) => {
      append({
        skill_label: "",
        is_custom: false,
        expected_level: 3,
        scope_include: "",
        scope_exclude: "",
        l1_anchor: "",
        l2_anchor: "",
        l3_anchor: "",
        l4_anchor: "",
        l5_anchor: "",
        ...skill,
        display_order: fields.length,
      });
    },
    [append, fields.length]
  );

  const onSubmit = React.useCallback(
    async (data: z.infer<typeof assessmentSchema>) => {
      setError(null);
      setSubmitting(true);

      try {
        const payload = {
          name: data.name,
          time_limit_min: data.time_limit_min,
          language: data.language,
          assessment_skills_attributes: data.skills.map(
            (skill, index) => ({
              ...skill,
              display_order: index,
            })
          ),
        };

        const response = await assessmentsApi.create(payload);

        navigate(
          `/assessments/${response.data.assessment.id}/invite`
        );
      } catch (e: unknown) {
        if (axios.isAxiosError(e)) {
          setError(
            e.response?.data?.errors?.[0]?.message ??
            "Unable to save assessment. Please try again."
          );
        } else {
          setError(
            "Unable to save assessment. Please try again."
          );
        }
      } finally {
        setSubmitting(false);
      }
    },
    [navigate]
  );

  return {
    form,
    fields,
    sensors,
    submitting,
    pickerOpen,
    error,
    remove,
    handleDragEnd,
    addCustomSkill,
    setError,
    addB7Skill,
    onSubmit,
    setPickerOpen,
    handleSubmit,
    setValue,
    watch,
  };
};