import { z } from "zod";
import { SkillComparisonSchema } from "./comparison";

export const FitGapReportSchema = z.object({
  id: z.number(),
  portfolio_id: z.number(),
  vacancy_id: z.number(),
  skill_comparisons: z.array(SkillComparisonSchema),
  culture_narrative: z.string(),
  overall_narrative: z.string(),
  generated_at: z.string()
});

export type FitGapReport = z.infer<typeof FitGapReportSchema>;
