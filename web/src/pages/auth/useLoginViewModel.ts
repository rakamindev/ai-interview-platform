import React from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { isAxiosError } from "axios";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { loginSchema } from "@/pages/auth/loginSchema";

export const useLoginViewModel = () => {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = React.useCallback(async (values: z.infer<typeof loginSchema>) => {
    try {
      const res = await authApi.login(values);
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch (err) {
      let errorMessage = "Something went wrong. Please try again later.";
      if (isAxiosError(err)) {
        if (!err.response) {
          errorMessage = "Unable to connect to the server. Please try again.";
        } else if (err.response.status === 401) {
          errorMessage = "Invalid email or password.";
        }
      }
      form.setError("root.serverError", {
        type: "manual",
        message: errorMessage,
      });
    }
  }, [form, navigate, setAuth]);

  return { form, onSubmit };
}