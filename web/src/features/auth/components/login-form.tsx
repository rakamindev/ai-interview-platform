import { valibotResolver } from "@hookform/resolvers/valibot";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { loginSchema, type LoginValues } from "@/features/auth/schemas/auth";
import { authMutations } from "@/features/auth/mutations/auth";
import { authAtom, saveToken, saveUser } from "@/stores/auth-atom";

export function LoginForm() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);

  const [openAlert, setOpenAlert] = useState(false);

  const form = useForm<LoginValues>({
    resolver: valibotResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { mutate: signIn, isPending: isLoading, error: errorSignIn } = useMutation(authMutations.login());

  const onSubmit = form.handleSubmit((values) => {
    setOpenAlert(false);
    signIn(values, {
      onSuccess: (response) => {
        if (response.token) {
          setAuth({ token: response.token, user: response.user });
          saveToken(response.token);
          saveUser(response.user);
          navigate({ to: "/" });
        }
      },
      onError: () => {
        setOpenAlert(true);
      },
    });
  });

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.6875rem]">Sign In</h1>
        <p className="text-sm text-pretty text-muted-foreground">Welcome back to AI Interview</p>
      </div>

      <form onSubmit={onSubmit}>
        <FieldGroup>
          {openAlert ? (
            <Field>
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Failed to sign in</AlertTitle>
                {errorSignIn?.data && errorSignIn.data.errors.length > 0 ? (
                  <AlertDescription>{errorSignIn.data.errors[0].message}</AlertDescription>
                ) : null}
                <AlertAction>
                  <Button size="icon-xs" variant="ghost" onClick={() => setOpenAlert(false)}>
                    <X />
                  </Button>
                </AlertAction>
              </Alert>
            </Field>
          ) : null}

          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  {...field}
                  id="email"
                  type="email"
                  placeholder="email@address.com"
                  autoComplete="email"
                  aria-invalid={fieldState.invalid}
                  required
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  {...field}
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={fieldState.invalid}
                  required
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Field>
            <Button type="submit" disabled={!form.formState.isValid || isLoading}>
              {isLoading && <Spinner data-icon="inline-start" />}
              Sign in
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
