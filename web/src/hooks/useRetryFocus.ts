import { useCallback, useEffect, useRef } from "react";

// After "Try again" the error and its button are replaced, so focus would
// fall to <body>. Call markRetry() before reloading; once loading ends, focus
// moves to the page heading (PageHeader's h1 takes focus).
export function useRetryFocus(loading: boolean) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const retrying = useRef(false);

  useEffect(() => {
    if (loading || !retrying.current) return;
    retrying.current = false;
    headingRef.current?.focus();
  }, [loading]);

  const markRetry = useCallback(() => {
    retrying.current = true;
  }, []);

  return { headingRef, markRetry };
}
