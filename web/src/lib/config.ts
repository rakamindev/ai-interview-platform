// Kept free of imports so pure utilities can read it without pulling in axios
// or the auth store.
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";
