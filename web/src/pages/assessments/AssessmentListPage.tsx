import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {Skeleton} from "@/components/ui/skeleton";
import {assessmentsApi} from "@/services/assessments";
import {ChevronRight, Clock, Plus, Search, UsersRound} from "lucide-react";
import type {Assessment, StatusCount} from "@/types";

function SessionSummary({session}: { session?: Assessment["latest_session"] }) {
    if (!session) return null;

    if (session.status === "active")
        return (
            <span className="flex items-center gap-1 text-xs text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"/>
                Live now
            </span>
        );

    if (session.status === "ended" && session.end_reason === "error")
        return <span className="text-xs text-destructive">Last: failed</span>;

    if (session.status === "ended")
        return <span className="text-xs text-muted-foreground">Last: completed</span>;

    return <span className="text-xs text-muted-foreground">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [statusCounter, setStatusCounter] = useState<StatusCount>({ running: 0, draft: 0, completed: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("running");
    const navigate = useNavigate();

    useEffect(() => {
        assessmentsApi
            .list()
            .then(function(res) {
                setAssessments(res.data.assessments)
                setStatusCounter(res.data.counters)
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, []);

    const filteredAssessments = useMemo(() => {
        const query = search.trim().toLowerCase();

        return assessments.filter((a) => {
            const matchesSearch =
                !query || a.name.toLowerCase().includes(query);

            const matchesStatus =
                statusFilter === "all" || a.vacancy_status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [assessments, search, statusFilter]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-y-2">
                    <h1 className="text-xl font-semibold">Assessments</h1>
                    <div className="hidden md:flex flex-row gap-x-2 text-xs ">
                        <span className="bg-blue-100 text-blue-700 rounded-full px-2.5 py-0.5">Running: {statusCounter.running}</span>
                        <span className="bg-yellow-100 text-yellow-700 rounded-full px-2.5 py-0.5">Draft: {statusCounter.draft}</span>
                        <span className="bg-green-100 text-green-700 rounded-full px-2.5 py-0.5">Completed: {statusCounter.completed}</span>
                    </div>
                </div>

                <Button onClick={() => navigate("/assessments/new")}>
                    <Plus className="h-4 w-4 mr-1.5"/> New Assessment
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search assessments..."
                        className="pl-9"
                    />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                        <SelectValue placeholder="Status"/>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {error && (
                <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
                    Failed to load assessments. Please refresh the page.
                </div>
            )}

            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full"/>
                    ))}
                </div>
            ) : filteredAssessments.length === 0 ? (
                <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
                    <p className="mb-3">
                        {search || statusFilter !== "all"
                            ? "No assessments match your filters."
                            : "No assessments yet."}
                    </p>

                    {!search && statusFilter === "all" && (
                        <Button
                            variant="outline"
                            onClick={() => navigate("/assessments/new")}
                        >
                            <Plus className="h-4 w-4 mr-1.5"/>
                            Create your first assessment
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredAssessments.map((a) => (
                        <Card
                            key={a.id}
                            className="cursor-pointer hover:border-primary/40 transition-colors"
                            onClick={() => navigate(`/assessments/${a.id}/invite`)}
                        >
                            <CardContent className="py-3 px-4 flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                    <div className="flex flex-row items-center gap-x-2">
                                        <span className="font-medium text-sm">{a.name}</span>
                                        <span
                                            className={`items-center rounded-full px-2.5 py-0.5 text-xs font-medium hidden md:inline-flex ${
                                                a.vacancy_status === "running"
                                                    ? "bg-blue-100 text-blue-700"
                                                    : a.vacancy_status === "draft"
                                                        ? "bg-gray-100 text-gray-700"
                                                        : "bg-blue-100 text-green-700"
                                            }`}
                                        >
                                            {a.vacancy_status}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3"/>
                                            {a.time_limit_min} min
                                        </span>

                                        {a.session_count > 0 && (
                                            <span className="flex items-center gap-1">
                                                <UsersRound className="h-3 w-3"/>
                                                {a.session_count} session{a.session_count > 1 ? "s" : ""}
                                            </span>
                                        )}

                                        {a.latest_session && (
                                            <>
                                                <span>·</span>
                                                <SessionSummary session={a.latest_session}/>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-row items-center justify-around gap-x-2">
                                    <span
                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium md:hidden ${
                                            a.vacancy_status === "running"
                                                ? "bg-blue-100 text-blue-700"
                                                : a.vacancy_status === "draft"
                                                    ? "bg-gray-100 text-gray-700"
                                                    : "bg-blue-100 text-green-700"
                                        }`}
                                    >
                                        {a.vacancy_status}
                                    </span>

                                    <ChevronRight className="h-4 w-4 text-muted-foreground"/>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}