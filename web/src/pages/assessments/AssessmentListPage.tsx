import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { assessmentsApi } from "@/services/assessments";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import {
  Plus,
  Clock,
  ChevronRight,
  ClipboardList,
  Search,
  ChevronLeft,
  Filter,
  CheckCircle2,
  Trash2,
  Users,
  Layers,
  X,
  Loader2,
  ArrowUpDown,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Assessment } from "@/types";

const ITEMS_PER_PAGE = 6;

function StatusBadge({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
        Ready
      </span>
    );
  }

  if (session.status === "active")
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        Live Now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
        Failed
      </span>
    );

  if (session.status === "ended")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
        <CheckCircle2 className="h-3 w-3 text-slate-500" />
        Completed
      </span>
    );

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Awaiting
    </span>
  );
}

function AssessmentCardItem({
  assessment,
  selectedSkill,
  onOpen,
  onDelete,
}: {
  assessment: Assessment;
  selectedSkill: string;
  onOpen: (a: Assessment) => void;
  onDelete: (a: Assessment) => void;
}) {
  const skillsList = assessment.skills || [];
  const displaySkills = skillsList.slice(0, 3);
  const remainingCount = skillsList.length - 3;

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 group flex flex-col justify-between overflow-hidden bg-white border-slate-200/90 rounded-2xl"
      onClick={() => onOpen(assessment)}
    >
      <div>
        {/* Card Header */}
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0 border border-primary/20 group-hover:scale-105 transition-transform">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
                  {assessment.name}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {assessment.time_limit_min} mins
                  </span>
                  <span>·</span>
                  <span>{skillsList.length} skills</span>
                  <span>·</span>
                  <span className="flex items-center gap-1 font-semibold text-slate-700 bg-slate-100/80 px-1.5 py-0.5 rounded-md">
                    <Users className="h-3 w-3 text-primary" />
                    {assessment.candidates_count ?? 0} kandidat
                  </span>
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <StatusBadge session={assessment.latest_session} />
            </div>
          </div>
        </CardHeader>

        {/* Card Body / Skills Preview */}
        <CardContent className="px-4 sm:px-5 py-3 space-y-3">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Kompetensi yang Diuji
            </span>
            {displaySkills.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Belum ada skill yang dikonfigurasi.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {displaySkills.map((s, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className={cn(
                      "text-[11px] py-0.5 px-2 font-normal border",
                      selectedSkill.toLowerCase() === s.skill_label.toLowerCase()
                        ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                    )}
                  >
                    {s.skill_label}
                  </Badge>
                ))}
                {remainingCount > 0 && (
                  <Badge variant="outline" className="text-[10px] text-slate-500 py-0.5 px-1.5 font-semibold">
                    +{remainingCount} lainnya
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </div>

      {/* Card Footer Actions: Delete on Left, Manage on Right */}
      <CardFooter className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(assessment);
          }}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          <span>Hapus</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(assessment);
          }}
        >
          <Users className="h-3.5 w-3.5 mr-1" />
          <span>Kandidat &amp; Detail</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [taxonomySkills, setTaxonomySkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchRole, setSearchRole] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "awaiting" | "ended">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name-asc" | "name-desc">("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [assessmentToDelete, setAssessmentToDelete] = useState<Assessment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  // Mobile Infinite Scroll State (Default 10 items per batch)
  const [mobileLimit, setMobileLimit] = useState(10);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    skillTaxonomiesApi
      .list()
      .then((res) => {
        setTaxonomySkills(res.data.skill_taxonomies.map((s) => s.skill_label));
      })
      .catch(() => {});
  }, []);

  // Extract all unique skills across master taxonomy + assessments
  const availableSkills = useMemo(() => {
    const skillSet = new Set<string>(taxonomySkills);
    assessments.forEach((a) => {
      a.skills?.forEach((s) => {
        if (s.skill_label?.trim()) skillSet.add(s.skill_label.trim());
      });
    });
    return Array.from(skillSet).sort();
  }, [assessments, taxonomySkills]);

  const filteredAssessments = useMemo(() => {
    const list = assessments.filter((a) => {
      const matchRole = !searchRole.trim() || a.name.toLowerCase().includes(searchRole.toLowerCase().trim());
      const matchSkill =
        selectedSkill === "all" ||
        a.skills?.some((s) => s.skill_label.toLowerCase() === selectedSkill.toLowerCase());

      let matchStatus = true;
      if (statusFilter === "active") {
        matchStatus = a.latest_session?.status === "active";
      } else if (statusFilter === "awaiting") {
        matchStatus = a.latest_session?.status === "pending" || !a.latest_session;
      } else if (statusFilter === "ended") {
        matchStatus = a.latest_session?.status === "ended";
      }

      return matchRole && matchSkill && matchStatus;
    });

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === "newest") return b.id - a.id;
      if (sortBy === "oldest") return a.id - b.id;
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "name-desc") return b.name.localeCompare(a.name);
      return 0;
    });
  }, [assessments, searchRole, selectedSkill, statusFilter, sortBy]);

  // Reset pagination & mobile limit on filter change
  useEffect(() => {
    setCurrentPage(1);
    setMobileLimit(10);
  }, [searchRole, selectedSkill, statusFilter, sortBy]);

  const totalPages = Math.ceil(filteredAssessments.length / ITEMS_PER_PAGE) || 1;
  const paginatedAssessments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAssessments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAssessments, currentPage]);

  const mobileAssessments = useMemo(() => {
    return filteredAssessments.slice(0, mobileLimit);
  }, [filteredAssessments, mobileLimit]);

  // Mobile Infinite Scroll Observer
  useEffect(() => {
    const sentinel = mobileSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && mobileLimit < filteredAssessments.length) {
          setTimeout(() => {
            setMobileLimit((prev) => prev + 10);
          }, 200);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [mobileLimit, filteredAssessments.length]);

  const handleDeleteConfirm = async () => {
    if (!assessmentToDelete) return;
    setIsDeleting(true);
    try {
      await assessmentsApi.delete(assessmentToDelete.id);
      setAssessments((prev) => prev.filter((a) => a.id !== assessmentToDelete.id));
      setAssessmentToDelete(null);
    } catch {
      setError(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const clearAllFilters = () => {
    setSearchRole("");
    setSelectedSkill("all");
    setStatusFilter("all");
    setSortBy("newest");
    setCurrentPage(1);
    setMobileLimit(10);
  };

  const hasActiveFilters =
    searchRole.trim() !== "" || selectedSkill !== "all" || statusFilter !== "all" || sortBy !== "newest";

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-28 sm:pb-8">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Assessments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your AI interview sessions, invited candidates, and evaluation criteria
          </p>
        </div>
        <Button
          onClick={() => navigate("/assessments/new")}
          className="hidden sm:flex bg-primary hover:bg-primary/90 text-white font-semibold h-10 shadow-xs rounded-xl"
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>Failed to perform action. Please refresh the page.</span>
        </div>
      )}

      {/* ── Filters Bar: Role Search + Searchable Skill Select + Sort By + Status Tabs ── */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 flex-1">
          {/* Filter 1: Search by Role Title */}
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search role title..."
              value={searchRole}
              onChange={(e) => setSearchRole(e.target.value)}
              className="pl-9 h-9 text-sm bg-slate-50/50 border-slate-200"
            />
          </div>

          {/* Filter 2: Searchable Dropdown Filter by Skill */}
          <SearchableSelect
            options={availableSkills}
            value={selectedSkill}
            onChange={setSelectedSkill}
            allLabel="All Skills"
            placeholder="Select skill"
          />

          {/* Filter 3: Sort By Dropdown */}
          <div className="w-full sm:w-44">
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200 font-medium">
                <div className="flex items-center gap-1.5 truncate">
                  <ArrowUpDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <SelectValue placeholder="Sort By" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest" className="text-xs">Newest First</SelectItem>
                <SelectItem value="oldest" className="text-xs">Oldest First</SelectItem>
                <SelectItem value="name-asc" className="text-xs">Role Name (A-Z)</SelectItem>
                <SelectItem value="name-desc" className="text-xs">Role Name (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-9 px-2 text-xs text-slate-500 hover:text-slate-900 self-start sm:self-auto"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
          )}
        </div>

        {/* Filter 4: Status Quick Tabs */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl shrink-0 overflow-x-auto scrollbar-hide">
          {[
            { id: "all", label: "All" },
            { id: "active", label: "Live Now" },
            { id: "awaiting", label: "Awaiting" },
            { id: "ended", label: "Completed" },
          ].map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer",
                  isSelected
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <div className="border-2 border-dashed rounded-3xl p-12 text-center space-y-4 bg-white">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <ClipboardList className="h-7 w-7 text-slate-400" />
          </div>
          <div className="max-w-sm mx-auto">
            <p className="font-bold text-slate-900 text-base">No assessments yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first AI interview assessment to begin evaluating candidates automatically.
            </p>
          </div>
          <Button onClick={() => navigate("/assessments/new")} className="bg-primary text-white shadow-xs rounded-xl">
            <Plus className="h-4 w-4 mr-1.5" /> Create Assessment
          </Button>
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="border border-slate-200 rounded-2xl p-10 text-center space-y-3 bg-white">
          <Filter className="h-8 w-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-900">No assessments match your filter</p>
          <p className="text-xs text-muted-foreground">Try clearing your search query or selecting a different skill.</p>
          <Button variant="outline" size="sm" onClick={clearAllFilters} className="rounded-xl">
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Desktop View (Paginated Grid) ── */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedAssessments.map((a) => (
              <AssessmentCardItem
                key={a.id}
                assessment={a}
                selectedSkill={selectedSkill}
                onOpen={(ass) => navigate(`/assessments/${ass.id}/invite`)}
                onDelete={(ass) => setAssessmentToDelete(ass)}
              />
            ))}
          </div>

          {/* ── Mobile View (Infinite Scroll List) ── */}
          <div className="sm:hidden space-y-3.5">
            {mobileAssessments.map((a) => (
              <AssessmentCardItem
                key={a.id}
                assessment={a}
                selectedSkill={selectedSkill}
                onOpen={(ass) => navigate(`/assessments/${ass.id}/invite`)}
                onDelete={(ass) => setAssessmentToDelete(ass)}
              />
            ))}

            {mobileLimit < filteredAssessments.length && (
              <div
                ref={mobileSentinelRef}
                className="py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Loading more assessments...</span>
              </div>
            )}

            {filteredAssessments.length > 0 && mobileLimit >= filteredAssessments.length && (
              <p className="py-3 text-center text-[11px] text-muted-foreground border-t border-slate-100">
                All {filteredAssessments.length} assessments loaded
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={!!assessmentToDelete} onOpenChange={(open) => !open && setAssessmentToDelete(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-[420px] rounded-3xl mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900">
              Delete Assessment?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-slate-800">"{assessmentToDelete?.name}"</span>? All associated candidates and session transcripts will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Delete Assessment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Desktop Pagination Controls (Hidden on mobile where infinite scroll is active) ── */}
      {!loading && filteredAssessments.length > ITEMS_PER_PAGE && (
        <div className="hidden sm:flex items-center justify-between pt-2 border-t border-slate-200">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-slate-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{" "}
            <span className="font-semibold text-slate-900">
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredAssessments.length)}
            </span>{" "}
            of <span className="font-semibold text-slate-900">{filteredAssessments.length}</span> assessments
          </p>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  className={cn("h-8 w-8 p-0 text-xs font-semibold", currentPage === pageNum ? "bg-primary text-white" : "")}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Mobile FAB ── */}
      <button
        onClick={() => navigate("/assessments/new")}
        className="fixed bottom-20 right-4 sm:hidden z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-white shadow-xl hover:bg-primary/90 active:scale-95 transition-all duration-150 cursor-pointer"
        aria-label="New Assessment"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
