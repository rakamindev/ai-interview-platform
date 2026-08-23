import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Page state backed by the URL query string (?page=N).
 *
 * - Refresh/back/forward and link sharing keep the current page.
 * - Page 1 renders without the param (clean URLs).
 * - Invalid or out-of-range values safely fall back to page 1.
 */
export function usePagination() {
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(raw) && raw > 0 ? raw : 1;

  const setPage = useCallback(
    (next: number) => {
      setSearchParams(next > 1 ? { page: String(next) } : {}, { replace: false });
    },
    [setSearchParams]
  );

  return { page, setPage };
}
