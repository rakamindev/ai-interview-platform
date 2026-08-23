import {useEffect, useState} from "react";
import {useFieldArray, useForm} from "react-hook-form";
import {Link, useNavigate, useParams} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Separator} from "@/components/ui/separator";
import {Skeleton} from "@/components/ui/skeleton";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import {vacanciesApi} from "@/services/vacancies";
import {ArrowLeft, Loader2, Plus, X} from "lucide-react";
import type {AssessmentSkill, VacancySkill} from "@/types";
import * as Select from "@radix-ui/react-select";
import NotFound from "@/components/NotFound.tsx";

interface VacancyFormValues {
    role_title: string;
    culture_dimensions: string;
    competency_expectations: string;
    status: string;
    skills: Partial<VacancySkill>[];
}

export default function VacancyEditPage() {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [vacancies, setVacancies] = useState<any[]>([]);
    const [vacancy, setVacancy] = useState<any | null>(null);
    const statuses = [
        {value: "draft", label: "Draft"},
        {value: "running", label: "Running"},
        {value: "completed", label: "Completed"},
    ];

    const {
        register,
        handleSubmit,
        control,
        setValue,
        watch,
        reset,
    } = useForm<VacancyFormValues>({
        defaultValues: {
            status: "draft",
            role_title: "",
            culture_dimensions: "",
            competency_expectations: "",
            skills: [],
        },
    });

    const {fields, append, remove} = useFieldArray({
        control,
        name: "skills",
        keyName: "fieldId",
    });

    const status = watch("status");

    useEffect(() => {
        if (!id) return;

        vacanciesApi
            .get(Number(id))
            .then((res) => {
                const v = res.data.vacancy;
                setVacancy(v);
                reset({
                    status: v.status || "draft",
                    role_title: v.role_title || "",
                    culture_dimensions: v.culture_dimensions || "",
                    competency_expectations: v.competency_expectations || "",
                    skills: v.skills || [],
                });
            })
            .catch(() => {
                // handle error if needed
            })
            .finally(() => setLoading(false));
    }, [id, reset]);

    const handleRemoveSkill = (index: number) => {
        const skill = watch(`skills.${index}`);

        console.log("Removing skill:", skill);

        if (skill?.id) {
            setValue(
                `skills.${index}._destroy`,
                true,
                {
                    shouldDirty: true,
                }
            );
        } else {
            remove(index);
        }
    };

    /**
     * Add a new skill.
     */
    const handleAddSkill = (skill: Partial<AssessmentSkill>) => {
        const skills = watch("skills");

        const isDuplicate = skills.some(
            (existingSkill) =>
                existingSkill.skill_taxonomy_id === skill.id
        );

        if (isDuplicate) {
            return;
        }

        append({
            skill_label: skill.skill_label,
            skill_taxonomy_id: skill.id,
            expected_level: skill.expected_level ?? 3,
        });
    };

    const onSubmit = async (data: VacancyFormValues) => {
        if (!id) return;

        setSubmitting(true);

        try {
            await vacanciesApi.update(Number(id), {
                role_title: data.role_title,
                status: data.status,
                culture_dimensions: data.culture_dimensions,
                competency_expectations: data.competency_expectations,

                vacancy_skills_attributes: data.skills,
            });

            navigate("/vacancies");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto space-y-4">
                <Skeleton className="h-8 w-48"/>
                <Skeleton className="h-10 w-full"/>
            </div>
        );
    }

    if(!vacancy) {
        return <NotFound backTo="/vacancies" message="Vacancy not found." />;
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
                <Link
                    to="/vacancies"
                    className="text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4"/>
                </Link>

                <span className="text-sm font-medium">
                    Edit Vacancy
                </span>
            </div>

            <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6"
            >
                {/* Role title */}
                <div className="space-y-1.5">
                    <Label>
                        Role title{" "}
                        <span className="text-destructive">*</span>
                    </Label>

                    <Input
                        {...register("role_title", {
                            required: true,
                        })}
                    />
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                    <Label>
                        Status{" "}
                        <span className="text-destructive">*</span>
                    </Label>

                    <Select.Root
                        value={status}
                        onValueChange={(value) =>
                            setValue("status", value)
                        }
                    >
                        <Select.Trigger
                            className="
                                flex h-10 w-full items-center justify-between
                                rounded-md border border-input
                                bg-background px-3 py-2 text-sm
                                ring-offset-background
                                focus-visible:outline-none
                                focus-visible:ring-2
                                focus-visible:ring-ring
                                focus-visible:ring-offset-2
                                disabled:cursor-not-allowed
                                disabled:opacity-50
                            "
                        >
                            <Select.Value placeholder="Select status"/>
                            <Select.Icon/>
                        </Select.Trigger>

                        <Select.Portal>
                            <Select.Content
                                className="
                                    rounded-md
                                    border
                                    bg-background
                                    shadow-md
                                "
                            >
                                <Select.Viewport className="p-1">
                                    {statuses.map((item) => (
                                        <Select.Item
                                            key={item.value}
                                            value={item.value}
                                            className="
                                                relative flex w-full
                                                cursor-default select-none
                                                items-center rounded-sm
                                                px-2 py-1.5 text-sm
                                                outline-none
                                                data-[highlighted]:bg-accent
                                                data-[highlighted]:text-accent-foreground
                                                hover:cursor-pointer
                                            "
                                        >
                                            <Select.ItemText>
                                                {item.label}
                                            </Select.ItemText>
                                        </Select.Item>
                                    ))}
                                </Select.Viewport>
                            </Select.Content>
                        </Select.Portal>
                    </Select.Root>
                </div>

                <Separator/>

                {/* Skills */}
                <div className="space-y-3">
                    <Label>Expected skills</Label>

                    {fields.map((field, index) => {
                        const skill = watch(`skills.${index}`);

                        if (skill?._destroy) {
                            return null;
                        }

                        return (
                            <div
                                key={field.fieldId}
                                className="border rounded-lg p-3 space-y-2"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">
                                        {skill?.skill_label}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSkill(index)}
                                        className="
                                            text-muted-foreground
                                            hover:text-destructive
                                        "
                                    >
                                        <X className="h-4 w-4"/>
                                    </button>
                                </div>

                                <LevelRadio
                                    value={skill?.expected_level ?? 3}
                                    onChange={(value) =>
                                        setValue(
                                            `skills.${index}.expected_level`,
                                            value,
                                            {
                                                shouldDirty: true,
                                            }
                                        )
                                    }
                                />
                            </div>
                        );
                    })}

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPickerOpen(true)}
                    >
                        <Plus className="h-3.5 w-3.5 mr-1"/>
                        Add skill
                    </Button>
                </div>

                <Separator/>

                {/* Company culture */}
                <div className="space-y-1.5">
                    <Label>Company culture</Label>

                    <Textarea
                        rows={3}
                        {...register("culture_dimensions")}
                    />
                </div>

                {/* Competency expectations */}
                <div className="space-y-1.5">
                    <Label>Competency expectations</Label>

                    <Textarea
                        rows={3}
                        {...register("competency_expectations")}
                    />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate("/vacancies")}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        disabled={submitting}
                    >
                        {submitting && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                        )}

                        Save Changes
                    </Button>
                </div>
            </form>

            <SkillPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                onSelect={handleAddSkill}
                selectedSkills={fields}
            />
        </div>
    );
}