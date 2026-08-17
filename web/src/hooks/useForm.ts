import { BaseSyntheticEvent } from "react";
import {
  FieldValues,
  SubmitHandler,
  UseFormProps as UseReactHookFormProps,
  UseFormReturn as UseReactHookFormReturn,
  useForm as useReactHookForm,
} from "react-hook-form";

export interface UseFormProps<
  TFieldValues extends FieldValues = FieldValues,
  Response = any,
  TContext = any,
  TTransformedValues = TFieldValues,
> extends UseReactHookFormProps<TFieldValues, TContext, TTransformedValues> {
  onSubmit: SubmitHandler<TTransformedValues, Response>;
}

export interface UseFormReturn<
  TFieldValues extends FieldValues = FieldValues,
  Response = any,
  TContext = any,
  TTransformedValues = TFieldValues,
> extends UseReactHookFormReturn<TFieldValues, TContext, TTransformedValues> {
  submitForm: (e?: BaseSyntheticEvent) => Promise<Awaited<Response> | undefined>;
}

export function useForm<
  TFieldValues extends FieldValues = FieldValues,
  Response = any,
  TContext = any,
  TTransformedValues = TFieldValues,
  Options extends UseFormProps<TFieldValues, Response, TContext, TTransformedValues> = UseFormProps<
    TFieldValues,
    Response,
    TContext,
    TTransformedValues
  >,
  Output extends UseFormReturn<TFieldValues, Response, TContext, TTransformedValues> =
    UseFormReturn<TFieldValues, Response, TContext, TTransformedValues>,
>(props: Options): Output {
  const { onSubmit, ...otherProps } = props;
  const result = useReactHookForm<TFieldValues, TContext, TTransformedValues>(otherProps);

  const submitForm = result.handleSubmit(onSubmit);

  return {
    ...result,
    submitForm,
  } as Output;
}
