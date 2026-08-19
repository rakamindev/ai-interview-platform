import { describe, it, expect, vi } from "vite-plus/test";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useForm } from "./useForm";

describe("useForm", () => {
  it("submits the current field values through submitForm", async () => {
    const onSubmit = vi.fn();
    let submitForm: (() => Promise<unknown>) | undefined;
    function FormFields() {
      const form = useForm<{ name: string }>({
        defaultValues: { name: "Ada" },
        onSubmit,
      });
      submitForm = () => form.submitForm();
      return <input {...form.register("name")} />;
    }
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitForm?.();
        }}
      >
        <FormFields />
      </form>,
    );
    fireEvent.submit(screen.getByRole("textbox"));
    await waitFor(() => expect(onSubmit.mock.calls[0][0]).toEqual({ name: "Ada" }));
  });

  it("exposes the full react-hook-form api alongside submitForm", () => {
    let api: ReturnType<typeof useForm<{ email: string }>> | undefined;
    function FormFields({ onSubmit }: { onSubmit: (v: unknown) => void }) {
      const form = useForm<{ email: string }>({
        defaultValues: { email: "a@b.c" },
        onSubmit,
      });
      api = form;
      return <input {...form.register("email")} />;
    }
    render(
      <form onSubmit={(e) => e.preventDefault()}>
        <FormFields onSubmit={vi.fn()} />
      </form>,
    );
    expect(api!.register).toBeTypeOf("function");
    expect(api!.handleSubmit).toBeTypeOf("function");
    expect(api!.submitForm).toBeTypeOf("function");
    expect(api!.getValues("email")).toBe("a@b.c");
  });

  it("does not call onSubmit when validation fails", async () => {
    const onSubmit = vi.fn();
    let submitForm: (() => Promise<unknown>) | undefined;
    function FormFields() {
      const form = useForm<{ name: string }>({
        defaultValues: { name: "" },
        onSubmit,
        resolver: async (values) => ({
          values: values.name ? values : {},
          errors: values.name ? {} : { name: { type: "required", message: "required" } },
        }),
      });
      submitForm = () => form.submitForm();
      return <input {...form.register("name")} />;
    }
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitForm?.();
        }}
      >
        <FormFields />
      </form>,
    );
    fireEvent.submit(screen.getByRole("textbox"));
    await new Promise((r) => setTimeout(r, 20));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
