import type { UserRole } from "../types/auth";

export type Permission =
  | "candidate:view"
  | "candidate:create"
  | "candidate:update"
  | "candidate:invite"
  | "assessment:view"
  | "assessment:create"
  | "assessment:update"
  | "assessment:conduct"
  | "portfolio:view"
  | "portfolio:review"
  | "hiring:decide";

const rolePermissions: Record<UserRole, Permission[]> = {
    recruiter: [
        "candidate:view",
        "candidate:create",
        "candidate:update",
        "candidate:invite",
        "assessment:view",
        "portfolio:view",
    ],

    assessor: [
        "candidate:view",
        "assessment:view",
        "assessment:create",
        "assessment:update",
        "assessment:conduct",
        "portfolio:view",
        "portfolio:review",
    ],

    hr_manager: [
        "candidate:view",
        "candidate:create",
        "candidate:update",
        "candidate:invite",
        "assessment:view",
        "assessment:create",
        "assessment:update",
        "portfolio:view",
        "portfolio:review",
        "hiring:decide",
    ],
    admin: []
};

export function hasPermission(
  role: UserRole,
  permission: Permission
): boolean {
  if (role === "admin") return true
  return rolePermissions[role]?.includes(permission) ?? false;
}