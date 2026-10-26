/**
 * F-05: Standard role-title options for the vacancy form.
 * Provides a curated list of common Indonesian hiring roles
 * plus an "Other (custom)" escape hatch with a 100-char cap.
 */

export const ROLE_TITLE_MAX_LENGTH = 100;

export const ROLE_TITLE_OPTIONS: readonly string[] = [
  // Engineering
  "Software Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Fullstack Engineer",
  "Mobile Engineer",
  "DevOps Engineer",
  "QA Engineer",
  "Data Engineer",
  "Machine Learning Engineer",
  "Engineering Manager",
  // Product & Design
  "Product Manager",
  "Product Designer",
  "UX Researcher",
  "UI Designer",
  // Data & Analytics
  "Data Analyst",
  "Data Scientist",
  "Business Analyst",
  // Operations & Management
  "Project Manager",
  "Scrum Master",
  "Technical Lead",
  // Other
  "Other (custom)",
] as const;

export const CUSTOM_ROLE_VALUE = "Other (custom)";
