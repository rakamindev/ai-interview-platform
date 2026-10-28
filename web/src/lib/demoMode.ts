export function isFitGapDemoEnabled(): boolean {
  return import.meta.env.DEV
    && typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("demo") === "fitgap";
}
