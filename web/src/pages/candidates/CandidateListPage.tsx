import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusCard } from "@/components/ui/status-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { candidatesApi } from "@/services/candidates";
import { CandidateDetailPanel } from "@/components/candidates/CandidateDetailPanel";
import { UserRound, Search } from "lucide-react";
import { getInitials } from "@/utils/initials";
import type { Candidate, PaginationMeta } from "@/types";

export default function CandidateListPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchList = (targetPage: number) => {
    setLoading(true);
    candidatesApi.list(targetPage, debouncedSearch || undefined)
      .then((res) => {
        setCandidates(res.data.candidates);
        setMeta(res.data.meta);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
      return;
    }
    fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    if (selectedId === null) {
      setSelectedCandidate(null);
      return;
    }
    setDetailLoading(true);
    candidatesApi.get(selectedId)
      .then((res) => setSelectedCandidate(res.data.candidate))
      .catch(() => setSelectedCandidate(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Candidates</h1>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          className="pl-9 h-11 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load candidates. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : candidates.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          {debouncedSearch ? (
            <p>No candidates match "{debouncedSearch}".</p>
          ) : (
            <>
              <UserRound className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p>No candidates yet.</p>
            </>
          )}
        </div>
      ) : selectedId === null ? (
        <div className="space-y-2">
          {candidates.map((c) => (
            <StatusCard key={c.id} tone="neutral" className="hover:shadow-md transition-shadow">
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                className="w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{getInitials(c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.sessions_count} interview{c.sessions_count === 1 ? "" : "s"}
                    </p>
                  </div>
                </CardContent>
              </button>
            </StatusCard>
          ))}
          {meta && <Pagination meta={meta} onPageChange={setPage} />}
        </div>
      ) : (
        <>
          <div className="hidden md:grid md:grid-cols-[320px_1fr] gap-4 items-start">
            <div className="space-y-2">
              {candidates.map((c) => (
                <StatusCard
                  key={c.id}
                  tone="neutral"
                  className={`transition-shadow ${selectedId === c.id ? "ring-2 ring-primary shadow-md" : "hover:shadow-md"}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className="w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{getInitials(c.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{c.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.sessions_count} interview{c.sessions_count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </CardContent>
                  </button>
                </StatusCard>
              ))}
              {meta && <Pagination meta={meta} onPageChange={setPage} />}
            </div>
            <Card className="sticky top-4">
              <CardContent className="p-5">
                <CandidateDetailPanel candidate={selectedCandidate} loading={detailLoading} />
              </CardContent>
            </Card>
          </div>

          <div className="md:hidden">
            <Card>
              <CardContent className="p-5">
                <CandidateDetailPanel
                  candidate={selectedCandidate}
                  loading={detailLoading}
                  onBack={() => setSelectedId(null)}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
