import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { authApi } from "@/services/auth";
import { saveToken } from "@/stores/authAtom";

export const useSignup = (
  opt?: UseMutationOptions<
    Awaited<ReturnType<typeof authApi.signup>>["data"],
    Error,
    { email: string; password: string; role: "admin" | "user" }
  >,
) => {
  return useMutation({
    mutationFn: (data) =>
      authApi.signup(data).then((r) => {
        saveToken(r.data.token);
        return r.data;
      }),
    ...opt,
  });
};
