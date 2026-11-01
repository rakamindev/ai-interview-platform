import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Blocks in-app navigation to another page while a form has unsaved changes, and asks the
 * browser to confirm a tab close or reload. Call allowNavigation() right before navigating
 * away after a successful save.
 */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  const allowedRef = useRef(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges &&
      !allowedRef.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  const allowNavigation = useCallback(() => {
    allowedRef.current = true;
  }, []);

  return { blocker, allowNavigation };
}
