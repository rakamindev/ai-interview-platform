import type { ReactNode } from "react";
import { AlertCircle, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Skeleton } from "./skeleton";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold sm:text-[28px] tracking-tight break-words">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
      <p className="flex-1 basis-48">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function TableLoading() {
  return (
    <div role="status" className="rounded-lg border">
      <span className="sr-only">Loading records</span>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-8 border-b p-4 last:border-0"
        >
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-5 w-1/5" />
          <Skeleton className="ml-auto h-5 w-20" />
        </div>
      ))}
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="search"
        aria-label={label}
        placeholder={label}
        className="pl-9 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => { onChange(""); inputRef.current?.focus(); }}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
export function Pagination({
  page,
  total,
  pageSize = 10,
  itemLabel = "results",
  onChange,
}: {
  page: number;
  total: number;
  pageSize?: number;
  itemLabel?: string;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs text-muted-foreground">
      <p role="status">
        {total
          ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} ${itemLabel}`
          : `No ${itemLabel}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span>
          Page {page} of {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
