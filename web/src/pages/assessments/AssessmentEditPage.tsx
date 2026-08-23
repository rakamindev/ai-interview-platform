import {useEffect, useState} from "react";
import {useFieldArray, useForm} from "react-hook-form";
import {Link, useNavigate, useParams} from "react-router-dom";
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,} from "@dnd-kit/sortable";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Separator} from "@/components/ui/separator";
import {Skeleton} from "@/components/ui/skeleton";
import SkillCard from "@/components/assessment/SkillCard";
import SkillPicker from "@/components/assessment/SkillPicker";
import {ArrowLeft, Loader2, Plus} from "lucide-react";
import {assessmentsApi} from "@/services/assessments";
import {vacanciesApi} from "@/services/vacancies";
import {TIME_LIMIT_OPTIONS} from "@/utils/constants";
import type {AssessmentFormValues} from "./AssessmentNewPage";

export default function AssessmentEditPage() {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [vacancies, setVacancies] = useState<any[]>([]);

    const form = useForm<AssessmentFormValues>({
        defaultValues: {
            vacancy_id: 0,
            time_limit_min: 45,
            language: "en",
            skills: [],
        },
    });

    const {handleSubmit, control, setValue, watch, reset} = form;
    const {fields, append, remove, move} = useFieldArray({
        control,
        name: "skills",
    });

    useEffect(() => {
        Promise.all([
            assessmentsApi.get(Number(id)),
            vacanciesApi.options(),
        ])
            .then(([assessmentRes, vacanciesRes]) => {
                const a = assessmentRes.data.assessment;

                setVacancies(vacanciesRes.data.vacancies);

                reset({
                    vacancy_id: a.vacancy_id,
                    time_limit_min: a.time_limit_min,
                    language: a.language,
                    skills: a.skills,
                });
            })
            .catch(() => {
                setError("Failed to load assessment.");
            })
            .finally(() => setLoading(false));
    }, [id, reset]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const {active, over} = event;

        if (over && active.id !== over.id) {
            const oldIndex = fields.findIndex((f) => f.id === active.id);
            const newIndex = fields.findIndex((f) => f.id === over.id);

            move(oldIndex, newIndex);
        }
    };

    const onSubmit = async (data: AssessmentFormValues) => {
        if (!data.vacancy_id) {
            setError("Please select a vacancy.");
            return;
        }

        if (data.skills.length === 0) {
            setError("Add at least one skill.");
            return;
        }

        setError(null);
        setSubmitting(true);

        try {
            await assessmentsApi.update(Number(id), {
                vacancy_id: data.vacancy_id,
                time_limit_min: data.time_limit_min,
                language: data.language,
                assessment_skills_attributes: data.skills.map((s, i) => ({
                    ...s,
                    display_order: i,
                })),
            });

            navigate(`/assessments/${id}/invite`);
        } catch (e: any) {
            setError(
                e?.response?.data?.errors?.[0]?.message ??
                "Failed to save."
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto space-y-4">
                <Skeleton className="h-8 w-48"/>
                <Skeleton className="h-10 w-full"/>
                <Skeleton className="h-10 w-40"/>
                <Skeleton className="h-24 w-full"/>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
                <Link
                    to="/assessments"
                    className="text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4"/>
                </Link>

                <span className="text-sm text-muted-foreground">Back</span>
                <span className="text-sm text-muted-foreground">/</span>
                <span className="text-sm font-medium">Edit Assessment</span>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Vacancy */}
                {/*<div className="space-y-1.5">*/}
                {/*    <Label>*/}
                {/*        Vacancy <span className="text-destructive">*</span>*/}
                {/*    </Label>*/}

                {/*    <Select*/}
                {/*        value={*/}
                {/*            form.watch("vacancy_id")*/}
                {/*                ? String(form.watch("vacancy_id"))*/}
                {/*                : undefined*/}
                {/*        }*/}
                {/*        onValueChange={(v) =>*/}
                {/*            setValue("vacancy_id", Number(v))*/}
                {/*        }*/}
                {/*    >*/}
                {/*        <SelectTrigger>*/}
                {/*            <SelectValue placeholder="Select vacancy"/>*/}
                {/*        </SelectTrigger>*/}

                {/*        <SelectContent className="max-w-[calc(100vw-2rem)]">*/}
                {/*            {vacancies.map((vacancy) => (*/}
                {/*                <SelectItem*/}
                {/*                    key={vacancy.id}*/}
                {/*                    value={String(vacancy.id)}*/}
                {/*                    className="whitespace-normal"*/}
                {/*                >*/}
                {/*                    {vacancy.role_title}*/}
                {/*                </SelectItem>*/}
                {/*            ))}*/}
                {/*        </SelectContent>*/}
                {/*    </Select>*/}
                {/*</div>*/}

                {/* Time limit */}
                <div className="space-y-1.5">
                    <Label>
                        Session time limit{" "}
                        <span className="text-destructive">*</span>
                    </Label>

                    <Select
                        value={String(form.watch("time_limit_min"))}
                        onValueChange={(v) =>
                            setValue("time_limit_min", Number(v))
                        }
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue/>
                        </SelectTrigger>

                        <SelectContent>
                            {TIME_LIMIT_OPTIONS.map((min) => (
                                <SelectItem
                                    key={min}
                                    value={String(min)}
                                >
                                    {min} min
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label>Interview language</Label>

                    <Select
                        value={watch("language")}
                        onValueChange={(value) =>
                            setValue("language", value as "en" | "id", {
                                shouldDirty: true,
                            })
                        }
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select language"/>
                        </SelectTrigger>

                        <SelectContent>
                            <SelectItem value="en">
                                English
                            </SelectItem>

                            <SelectItem value="id">
                                Indonesian
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Separator/>

                <div className="space-y-3">
                    <Label>Skills to assess</Label>

                    {fields.length === 0 ? (
                        <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
                            No skills added yet.
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={fields.map((f) => f.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2">
                                    {fields.map((field, index) => (
                                        <SkillCard
                                            key={field.id}
                                            id={field.id}
                                            index={index}
                                            form={form}
                                            onRemove={() => remove(index)}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPickerOpen(true)}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1"/>
                            Add from B7 taxonomy
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                append({
                                    skill_label: "",
                                    scope_include: "",
                                    is_custom: true,
                                    expected_level: 3,
                                    display_order: fields.length,
                                })
                            }
                        >
                            <Plus className="h-3.5 w-3.5 mr-1"/>
                            Add custom skill
                        </Button>
                    </div>
                </div>

                <Separator/>

                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}

                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                            navigate(`/assessments/${id}/invite`)
                        }
                    >
                        Cancel
                    </Button>

                    <Button type="submit" disabled={submitting}>
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
                selectedSkills={fields}
                onSelect={(s) =>
                    append({
                        ...s,
                        display_order: fields.length,
                    })
                }
            />
        </div>
    );
}