import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}
export type SignupPayload = LoginPayload; // backend creates admin accounts
export interface AuthResponse {
  token: string;
}

// Keep paths in sync with api/config/routes.rb
export const authApi = {
  login: (data: LoginPayload) => api.post<AuthResponse>("/auth/login", data),
  signup: (data: SignupPayload) => api.post<AuthResponse>("/auth/signup", data),
};

// import api from "./api";

// export interface LoginPayload {
//   email: string;
//   password: string;
// }

// export interface LoginResponse {
//   token: string;
// }

// export const authApi = {
//   login: (data: LoginPayload) =>
//     api.post<LoginResponse>("/auth/login", data),

//   signup: (data: { email: string; password: string; role: "admin" | "user" }) =>
//     api.post<LoginResponse>("/signup", data),
// };
