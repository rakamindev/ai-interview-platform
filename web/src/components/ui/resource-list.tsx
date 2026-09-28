import { FilterSelect } from "@/components/ui/filter-select";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "./button";
import {
  PageHeader,
  ErrorState,
  EmptyState,
  TableLoading,
  SearchField,
  Pagination,
} from "./page";
import type { PaginationMeta } from "@/types";

interface Column<T> {
  label: string;
  render: (record: T) => ReactNode;
}
interface Props<T> {
  title: string;
  description: string;
  singular: string;
  createHref: string;
  load: (page: number) => Promise<{ records: T[]; meta: PaginationMeta }>;
  columns: Column<T>[];
  name: (record: T) => string;
  status?: (record: T) => string;
  statuses?: string[];
}
export default function ResourceList<T extends { id: number }>({
  title,
  description,
  singular,
  createHref,
  load,
  columns,
  name,
  status,
  statuses,
}: Props<T>) {
  const [records, setRecords] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [sort, setSort] = useState("default");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    load(page)
      .then((data) => {
        if (active) {
          setRecords(data.records);
          setMeta(data.meta);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load, page, attempt]);
  const visible = records.filter(
    (record) =>
      name(record).toLowerCase().includes(query.trim().toLowerCase()) &&
      (!status || filter === "All statuses" || status(record) === filter),
  );
  if (sort !== "default")
    visible.sort(
      (a, b) => name(a).localeCompare(name(b)) * (sort === "asc" ? 1 : -1),
    );
  const filtered = !!query || filter !== "All statuses";
  const create = (
    <Button asChild>
      <Link to={createHref}>
        <Plus />
        New {singular}
      </Link>
    </Button>
  );
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} actions={create} />
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          value={query}
          onChange={setQuery}
          label={`Search ${title.toLowerCase()} on this page`}
        />
        {statuses && (
          <FilterSelect label="Filter by latest interview status on this page" className="w-full sm:w-48" value={filter} onValueChange={(value) => setFilter(value)} options={["All statuses", ...statuses].map((label) => ({ value: label, label }))} />
        )}
        <FilterSelect label="Sort this page" className="w-full sm:w-48 sm:ml-auto" value={sort} onValueChange={(value) => setSort(value)} options={[{"value":"default","label":"Newest first"}, {"value":"asc","label":"Name: A–Z"}, {"value":"desc","label":"Name: Z–A"}]} />
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setFilter("All statuses");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      {filtered && (
        <p role="status" className="text-xs text-muted-foreground">
          {visible.length} matching {title.toLowerCase()} on this page. Search
          and filters apply to the current page.
        </p>
      )}
      {loading ? (
        <TableLoading />
      ) : error ? (
        <ErrorState
          message={`Couldn't load ${title.toLowerCase()}. Your records have not been changed.`}
          onRetry={() => setAttempt((a) => a + 1)}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            {!records.length ? (
              <EmptyState
                title={`No ${title.toLowerCase()} yet`}
                description={
                  singular === "assessment"
                    ? "Create an assessment to define interview skills and start inviting candidates."
                    : "Define a role and its expectations to compare candidate portfolios against it."
                }
                action={create}
              />
            ) : !visible.length ? (
              <EmptyState
                title="No matching results"
                description="Try a different search or clear your filters."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                      setFilter("All statuses");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <table className="data-table">
                <caption className="sr-only">{title}</caption>
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c.label} scope="col">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((record) => (
                    <tr key={record.id}>
                      {columns.map((c) => (
                        <td key={c.label}>{c.render(record)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {meta && (
            <Pagination
              page={page}
              itemLabel={title.toLowerCase()}
              total={meta.total_count}
              pageSize={meta.per_page}
              onChange={(p) => {
                setPage(p);
                setQuery("");
                setFilter("All statuses");
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
