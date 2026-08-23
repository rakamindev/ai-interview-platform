import {useEffect, useState} from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Loader2, Search} from "lucide-react";
import {skillTaxonomiesApi} from "@/services/skillTaxonomies";
import type {AssessmentSkill, SkillTaxonomy} from "@/types";

interface SkillPickerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (skill: Partial<AssessmentSkill>) => void;
    selectedSkills?: Partial<AssessmentSkill>[];
}

export default function SkillPicker({
                                        open,
                                        onOpenChange,
                                        onSelect,
                                        selectedSkills = [],
                                    }: SkillPickerProps) {
    const [skills, setSkills] = useState<SkillTaxonomy[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [query, setQuery] = useState("");

    const selectedSkillIds = new Set(
        selectedSkills
            .filter((skill) => !skill.is_custom)
            .map((skill) => skill.skill_taxonomy_id ?? skill.skill_id)
    );

    useEffect(() => {
        if (!open || loaded) {
            return;
        }

        setLoading(true);

        skillTaxonomiesApi
            .listFull()
            .then((res) => {
                setSkills(res.data.skill_taxonomies ?? []);
                setLoaded(true);
            })
            .catch((err) => {
                console.error("skill_taxonomies fetch failed:", err);
                setSkills([]);
                setLoaded(true);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [open, loaded]);

    const filtered = skills.filter((s) => {
        const matchesQuery = s.skill_label
            .toLowerCase()
            .includes(query.toLowerCase());

        const alreadySelected = selectedSkillIds.has(s.id);

        return matchesQuery && !alreadySelected;
    });

    const handleSelect = (s: SkillTaxonomy) => {
        onSelect({
            id: s.id,
            skill_taxonomy_id: s.id,
            skill_id: s.skill_id,
            skill_label: s.skill_label,
            is_custom: false,
            expected_level: 3,
            scope_include: s.scope_include,
            l1_anchor: s.l1_anchor,
            l2_anchor: s.l2_anchor,
            l3_anchor: s.l3_anchor,
            l4_anchor: s.l4_anchor,
            l5_anchor: s.l5_anchor,
        });

        onOpenChange(false);
        setQuery("");
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        Add from B7 taxonomy
                    </DialogTitle>
                </DialogHeader>

                <div className="relative">
                    <Search
                        className="
                            absolute left-3 top-1/2
                            -translate-y-1/2
                            h-4 w-4
                            text-muted-foreground
                        "
                    />

                    <Input
                        placeholder="Search skills..."
                        value={query}
                        onChange={(e) =>
                            setQuery(e.target.value)
                        }
                        className="pl-9"
                        autoFocus
                    />
                </div>

                <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2
                                className="
                                    h-5 w-5
                                    animate-spin
                                    text-muted-foreground
                                "
                            />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="
                            text-sm
                            text-muted-foreground
                            text-center
                            py-6
                        ">
                            No skills found.
                        </p>
                    ) : (
                        filtered.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => handleSelect(s)}
                                className="
                                    w-full text-left
                                    px-3 py-2
                                    rounded-md
                                    hover:bg-muted
                                    transition-colors
                                    text-sm
                                "
                            >
                                {s.skill_label}
                            </button>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}