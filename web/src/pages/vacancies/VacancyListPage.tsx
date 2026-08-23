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
import {vacanciesApi} from "@/services/vacancies";
import {Briefcase, ChevronRight, Plus, Search} from "lucide-react";
import type {StatusCount, Vacancy} from "@/types";

export default function VacancyListPage() {
    const [vacancies, setVacancies] = useState<Vacancy[]>([]);
    const [statusCounter, setStatusCounter] = useState<StatusCount>({ running: 0, draft: 0, completed: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("running");
    const navigate = useNavigate();

    useEffect(() => {
        vacanciesApi.list()
            .then(function(res) {
                setVacancies(res.data.vacancies)
                setStatusCounter(res.data.counters)
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, []);

    const filteredVacancies = useMemo(() => {
        const query = search.trim().toLowerCase();

        return vacancies.filter((v) => {
            const matchesSearch =
                !query || v.role_title.toLowerCase().includes(query);

            const matchesStatus =
                statusFilter === "all" || v.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [vacancies, search, statusFilter]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-y-2">
                    <h1 className="text-xl font-semibold">Vacancies</h1>
                    <div className="flex-row gap-x-2 text-xs hidden md:flex">
                        <span className="bg-blue-100 text-blue-700 rounded-full px-2.5 py-0.5">Running: {statusCounter.running}</span>
                        <span className="bg-yellow-100 text-yellow-700 rounded-full px-2.5 py-0.5">Draft: {statusCounter.draft}</span>
                        <span className="bg-green-100 text-green-700 rounded-full px-2.5 py-0.5">Completed: {statusCounter.completed}</span>
                    </div>
                </div>

                <Button onClick={() => navigate("/vacancies/new")}>
                    <Plus className="h-4 w-4 mr-1.5"/> New Vacancy
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search vacancies..."
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
                    Failed to load vacancies. Please refresh the page.
                </div>
            )}

            {loading ? (
                <div className="space-y-2">
                    {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full"/>)}
                </div>
            ) : filteredVacancies.length === 0 ? (
                <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
                    <p className="mb-3">
                        {search || statusFilter !== "all"
                            ? "No vacancies match your filters."
                            : "No vacancies yet."}
                    </p>

                    {!search && statusFilter === "all" && (
                        <Button
                            variant="outline"
                            onClick={() => navigate("/vacancies/new")}
                        >
                            <Plus className="h-4 w-4 mr-1.5"/>
                            Create your first vacancy
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredVacancies.map((v) => (
                        <Card
                            key={v.id}
                            className="cursor-pointer hover:border-primary/40 transition-colors"
                            onClick={() => navigate(`/vacancies/${v.id}/edit`)}
                        >
                            <CardContent className="py-3 px-4 flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Briefcase className="h-4 w-4 text-muted-foreground shrink-0"/>

                                    <span className="font-medium text-sm truncate">
                                        {v.role_title}
                                    </span>

                                    {/* Desktop status */}
                                    <span
                                        className={`hidden md:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                            v.status === "running"
                                                ? "bg-blue-100 text-blue-700"
                                                : v.status === "draft"
                                                    ? "bg-gray-100 text-gray-700"
                                                    : "bg-blue-100 text-green-700"
                                        }`}
                                    >
                                        {v.status}
                                    </span>
                                </div>

                                {/* Mobile status + chevron */}
                                <div className="flex flex-row items-center justify-around gap-x-2 shrink-0">
                                    <span
                                        className={`inline-flex md:hidden items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                            v.status === "running"
                                                ? "bg-blue-100 text-blue-700"
                                                : v.status === "draft"
                                                    ? "bg-gray-100 text-gray-700"
                                                    : "bg-blue-100 text-green-700"
                                        }`}
                                    >
                                        {v.status}
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