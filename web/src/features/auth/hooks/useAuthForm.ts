import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import type { AxiosResponse } from "axios";
import { authAtom, saveToken } from "@/features/auth/stores/authAtom";

interface AuthResponse {
  token: string;
}

interface UseAuthFormOptions {
  errorMessage: string;
  redirectTo?: string;
}

/**
 * Shared submit lifecycle for the login form: loading + error state, token
 * persistence, and redirect on success. Centralized here so a behavior
 * change (e.g. a new redirect target) only needs one edit.
 */
export function useAuthForm<TValues>(
  request: (values: TValues) => Promise<AxiosResponse<AuthResponse>>,
  { errorMessage, redirectTo = "/assessments" }: UseAuthFormOptions
) {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (values: TValues) => {
    setError(null);
    setLoading(true);
    try {
      const res = await request(values);
      saveToken(res.data.token);
      setAuth({ token: res.data.token });
      navigate(redirectTo);
    } catch {
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading, error };
}
