import { useEffect, useState, useMemo } from "react";
import { skillTaxonomiesApi, type SkillPayload } from "@/services/skillTaxonomies";
import type { SkillTaxonomy } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, Trash2, Edit2, UploadCloud } from "lucide-react";

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillTaxonomy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [fetchError, setFetchError] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillTaxonomy | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Single form state
  const [formLabel, setFormLabel] = useState("");
  const [formId, setFormId] = useState("");
  const [formCategory, setFormCategory] = useState("engineering");
  const [formScopeInclude, setFormScopeInclude] = useState("");
  const [formScopeExclude, setFormScopeExclude] = useState("");
  const [formL1, setFormL1] = useState("");
  const [formL2, setFormL2] = useState("");
  const [formL3, setFormL3] = useState("");
  const [formL4, setFormL4] = useState("");
  const [formL5, setFormL5] = useState("");

  // Bulk form state
  const [bulkText, setBulkText] = useState("");
  const [bulkCategory, setBulkCategory] = useState("engineering");

  const loadSkills = async () => {
    try {
      setLoading(true);
      setFetchError(false);
      const res = await skillTaxonomiesApi.list();
      setSkills(res.data.skill_taxonomies || []);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      const matchesSearch =
        s.skill_label.toLowerCase().includes(search.toLowerCase()) ||
        s.skill_id.toLowerCase().includes(search.toLowerCase());
      const matchesCat =
        selectedCategory === "all" || s.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [skills, search, selectedCategory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredSkills.length / PAGE_SIZE));
  const paginatedSkills = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredSkills.slice(start, start + PAGE_SIZE);
  }, [filteredSkills, currentPage]);

  const openCreateModal = () => {
    setEditingSkill(null);
    setFormLabel("");
    setFormId("");
    setFormCategory("engineering");
    setFormScopeInclude("");
    setFormScopeExclude("");
    setFormL1("");
    setFormL2("");
    setFormL3("");
    setFormL4("");
    setFormL5("");
    setError(null);
    setShowCreateModal(true);
  };

  const openEditModal = (skill: SkillTaxonomy) => {
    setEditingSkill(skill);
    setFormLabel(skill.skill_label);
    setFormId(skill.skill_id);
    setFormCategory(skill.category || "engineering");
    setFormScopeInclude(skill.scope_include || "");
    setFormScopeExclude(skill.scope_exclude || "");
    setFormL1(skill.l1_anchor || "");
    setFormL2(skill.l2_anchor || "");
    setFormL3(skill.l3_anchor || "");
    setFormL4(skill.l4_anchor || "");
    setFormL5(skill.l5_anchor || "");
    setError(null);
    setShowCreateModal(true);
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim()) {
      setError("Skill name is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: SkillPayload = {
      skill_id: formId.trim() || undefined,
      skill_label: formLabel.trim(),
      category: formCategory,
      scope_include: formScopeInclude.trim() || undefined,
      scope_exclude: formScopeExclude.trim() || undefined,
      l1_anchor: formL1.trim() || undefined,
      l2_anchor: formL2.trim() || undefined,
      l3_anchor: formL3.trim() || undefined,
      l4_anchor: formL4.trim() || undefined,
      l5_anchor: formL5.trim() || undefined,
    };

    try {
      if (editingSkill) {
        await skillTaxonomiesApi.update(editingSkill.skill_id, payload);
      } else {
        await skillTaxonomiesApi.create(payload);
      }
      setShowCreateModal(false);
      await loadSkills();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { errors?: Array<{ message: string }> } }; message?: string };
      setError(errObj.response?.data?.errors?.[0]?.message || errObj.message || "Failed to save skill");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkCreate = async () => {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setError("Please enter at least one skill name");
      return;
    }

    setSubmitting(true);
    setError(null);

    const skillsPayload: SkillPayload[] = lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      const label = parts[0];
      const id = parts[1] || label.toLowerCase().replace(/[^a-z0-9]/g, "_");
      return {
        skill_id: id,
        skill_label: label,
        category: bulkCategory,
      };
    });

    try {
      await skillTaxonomiesApi.bulkCreate(skillsPayload);
      setShowBulkModal(false);
      setBulkText("");
      await loadSkills();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { errors?: Array<{ message: string }> } }; message?: string };
      setError(errObj.response?.data?.errors?.[0]?.message || errObj.message || "Failed to bulk create skills");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (skillId: string) => {
    if (!window.confirm("Are you sure you want to delete this skill?")) return;
    try {
      await skillTaxonomiesApi.delete(skillId);
      setSkills((prev) => prev.filter((s) => s.skill_id !== skillId));
    } catch {
      alert("Failed to delete skill");
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skill Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Standard and custom competencies with L1–L5 proficiency rubric anchors.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkModal(true)}>
            <UploadCloud className="h-4 w-4 mr-1.5" />
            Bulk Create
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Skill
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skills by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="flex h-10 w-full sm:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All Categories</option>
          <option value="engineering">Engineering</option>
          <option value="soft_skills">Soft Skills</option>
          <option value="product_process">Product & Process</option>
        </select>
      </div>

      {/* Skills Table */}
      {fetchError && (
        <ErrorState
          title="Failed to load skills"
          description="An error occurred while fetching the skill library. Please check your connection and try again."
          onRetry={loadSkills}
        />
      )}

      <div className="border rounded-lg overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-semibold">Skill Name / Identifier</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Scope Include / Exclude</th>
                <th className="py-3 px-4 font-semibold">L3 Target Anchor</th>
                <th className="py-3 px-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td className="py-3.5 px-4 space-y-1.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-20" />
                    </td>
                    <td className="py-3.5 px-4">
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </td>
                    <td className="py-3.5 px-4">
                      <Skeleton className="h-4 w-44" />
                    </td>
                    <td className="py-3.5 px-4">
                      <Skeleton className="h-4 w-52" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredSkills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No skills found matching your search.
                  </td>
                </tr>
              ) : (
                paginatedSkills.map((s) => (
                  <tr key={s.skill_id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-foreground">{s.skill_label}</div>
                      <div className="text-xs font-mono text-muted-foreground">{s.skill_id}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="outline" className="text-xs capitalize">
                        {s.category ? s.category.replace("_", " ") : "engineering"}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-xs text-muted-foreground">
                      {s.scope_include || "All relevant technical patterns"}
                    </td>
                    <td className="py-3.5 px-4 max-w-sm truncate text-xs text-foreground">
                      {s.l3_anchor || "Autonomous proficiency and troubleshooting."}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditModal(s)}
                          title="Edit skill"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(s.skill_id)}
                          title="Delete skill"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination & Count Meta */}
      {filteredSkills.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 text-xs text-muted-foreground">
          <span>
            Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredSkills.length)}–
            {Math.min(currentPage * PAGE_SIZE, filteredSkills.length)} of {filteredSkills.length} skills
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Create / Edit Skill Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSkill ? "Edit Skill Competency" : "New Skill Competency"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSkill} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="formLabel">
                  Skill Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="formLabel"
                  placeholder="e.g. Distributed Consensus"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="formCategory">Category</Label>
                <select
                  id="formCategory"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="engineering">Engineering</option>
                  <option value="soft_skills">Soft Skills</option>
                  <option value="product_process">Product & Process</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="formId">Unique Identifier (Optional)</Label>
              <Input
                id="formId"
                placeholder="e.g. distributed_consensus (auto-generated if empty)"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                disabled={!!editingSkill}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="formScopeInclude">What counts (Scope Include)</Label>
              <Textarea
                id="formScopeInclude"
                placeholder="e.g. Raft, Paxos, leader election, split-brain recovery..."
                value={formScopeInclude}
                onChange={(e) => setFormScopeInclude(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2 border-t pt-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Proficiency Level Rubric Anchors
              </span>

              <div className="space-y-2">
                <Input
                  placeholder="L1: Basic conceptual understanding..."
                  value={formL1}
                  onChange={(e) => setFormL1(e.target.value)}
                />
                <Input
                  placeholder="L2: Hands-on implementation of standard tasks..."
                  value={formL2}
                  onChange={(e) => setFormL2(e.target.value)}
                />
                <Input
                  placeholder="L3: Autonomous production problem-solving..."
                  value={formL3}
                  onChange={(e) => setFormL3(e.target.value)}
                />
                <Input
                  placeholder="L4: Architectural leadership and performance optimization..."
                  value={formL4}
                  onChange={(e) => setFormL4(e.target.value)}
                />
                <Input
                  placeholder="L5: Industry mastery and strategic thought leadership..."
                  value={formL5}
                  onChange={(e) => setFormL5(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingSkill ? "Save Changes" : "Create Skill"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Modal */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Bulk Add Skills</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="engineering">Engineering</option>
                <option value="soft_skills">Soft Skills</option>
                <option value="product_process">Product & Process</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulkText">Skill Names (One per line)</Label>
              <Textarea
                id="bulkText"
                placeholder={"Kubernetes Orchestration\nDatabase Sharding\nKafka Stream Processing\nSystem Observability"}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Enter one skill per line. Optional format: <code>Skill Name | skill_id</code>.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkCreate} disabled={submitting}>
              {submitting ? "Creating..." : "Create Skills"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
