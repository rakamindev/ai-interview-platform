import {useState} from "react";
import {useFieldArray, useForm} from "react-hook-form";
import {Link, useNavigate} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Separator} from "@/components/ui/separator";
import LevelRadio from "@/components/assessment/LevelRadio";
import SkillPicker from "@/components/assessment/SkillPicker";
import {vacanciesApi} from "@/services/vacancies";
import {ArrowLeft, Loader2, Plus, X} from "lucide-react";
import type {VacancySkill} from "@/types";
import * as Select from "@radix-ui/react-select";

interface VacancyFormValues {
    role_title: string;
    culture_dimensions: string;
    competency_expectations: string;
    status: string;
    skills: Partial<VacancySkill>[];
}

export default function VacancyNewPage() {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        formState: {errors},
    } = useForm<VacancyFormValues>({
        defaultValues: {
            role_title: "",
            culture_dimensions: "",
            competency_expectations: "",
            status: "draft",
            skills: [],
        },
    });

    const {fields, append, remove} = useFieldArray({
        control,
        name: "skills",
    });

    const status = watch("status");

    const onSubmit = async (data: VacancyFormValues) => {
        setError(null);
        setSubmitting(true);

        try {
            await vacanciesApi.create({
                role_title: data.role_title,
                status: data.status,
                culture_dimensions: data.culture_dimensions,
                competency_expectations: data.competency_expectations,
                vacancy_skills_attributes: data.skills,
            });

            navigate("/vacancies");
        } catch (e: any) {
            setError(
                e?.response?.data?.errors?.[0]?.message ??
                "Failed to save vacancy."
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
                <Link
                    to="/vacancies"
                    className="text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4"/>
                </Link>

                <span className="text-sm text-muted-foreground">
                    Vacancies
                </span>

                <span className="text-sm text-muted-foreground">/</span>

                <span className="text-sm font-medium">
                    New Vacancy
                </span>
            </div>

            <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6"
            >
                <div className="space-y-1.5">
                    <Label htmlFor="role_title">
                        Role title{" "}
                        <span className="text-destructive">*</span>
                    </Label>

                    <Input
                        id="role_title"
                        placeholder="Senior Frontend Engineer"
                        {...register("role_title", {required: true})}
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
                            "
                        >
                            <Select.Value placeholder="Select status"/>
                            <Select.Icon/>
                        </Select.Trigger>

                        <Select.Portal>
                            <Select.Content className="rounded-md border bg-background shadow-md">
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

                {/* Expected skills */}
                <div className="space-y-3">
                    <Label>Expected skills</Label>

                    {fields.length === 0 ? (
                        <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
                            No skills added yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {fields.map((field, index) => (
                                <div
                                    key={field.id}
                                    className="border rounded-lg p-3 space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">
                                            {watch(
                                                `skills.${index}.skill_label`
                                            )}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => remove(index)}
                                            className="text-muted-foreground hover:text-destructive"
                                        >
                                            <X className="h-4 w-4"/>
                                        </button>
                                    </div>

                                    <div className="space-y-1">
                                        <span className="text-xs text-muted-foreground">
                                            Expected level:
                                        </span>

                                        <LevelRadio
                                            value={
                                                watch(
                                                    `skills.${index}.expected_level`
                                                ) ?? 3
                                            }
                                            onChange={(v) =>
                                                setValue(
                                                    `skills.${index}.expected_level`,
                                                    v
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPickerOpen(true)}
                    >
                        <Plus className="h-3.5 w-3.5 mr-1"/>
                        Add skill expectation
                    </Button>
                </div>

                <Separator/>

                <div className="space-y-1.5">
                    <Label htmlFor="culture_dimensions">
                        Company culture (used in AI narrative)
                    </Label>

                    <Textarea
                        id="culture_dimensions"
                        placeholder="Ownership-driven, async-first, direct feedback culture..."
                        rows={3}
                        {...register("culture_dimensions")}
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="competency_expectations">
                        Competency expectations (used in AI narrative)
                    </Label>

                    <Textarea
                        id="competency_expectations"
                        placeholder="Strong communicator who can align cross-functional teams..."
                        rows={3}
                        {...register("competency_expectations")}
                    />
                </div>

                {error && (
                    <p className="text-sm text-destructive">
                        {error}
                    </p>
                )}

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
                        Save Vacancy
                    </Button>
                </div>
            </form>

            <SkillPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                selectedSkills={fields}
                onSelect={function (skill) {
                    console.log(skill)
                    append({
                        skill_taxonomy_id: skill.id,
                        skill_label: skill.skill_label,
                        expected_level: 3,
                    });

                }}
            />
        </div>
    );
}