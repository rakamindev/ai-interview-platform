import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { authApi, type LoginPayload, type LoginResponse } from "@/services/auth";
import { saveToken } from "@/stores/authAtom";

export const useLogin = (
  opt?: UseMutationOptions<LoginResponse, Error, LoginPayload>,
) => {
  return useMutation({
    mutationFn: (data) =>
      authApi.login(data).then((r) => {
        saveToken(r.data.token);
        return r.data;
      }),
    ...opt,
  });
};
