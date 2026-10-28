import { useEffect } from "react";

const APP_NAME = "Rakamin AI Interview";

/**
 * Sets document.title dynamically.
 * Usage: usePageTitle("Assessments") → "Assessments · Rakamin AI Interview"
 */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}
