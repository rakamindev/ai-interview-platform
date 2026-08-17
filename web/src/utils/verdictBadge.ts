import type { Verdict } from "@/types";

export const VERDICT_BADGE_CLASSES: Record<Verdict, string> = {
  pass: "bg-green-100 text-green-700",
  consider: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  pass: "Pass",
  consider: "Consider",
  failed: "Failed",
};
