export type UserRole =
  | "recruiter"
  | "assessor"
  | "hr_manager"
  | "admin";

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}