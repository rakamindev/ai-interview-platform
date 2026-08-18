import { mergeProps, useRender } from "@base-ui/react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * CSS variable architecture for FramePanel theming:
 *
 * The Frame parent sets --frame-panel-bg and --frame-panel-border-color.
 * FramePanel consumes them directly via bg-(--frame-panel-bg) and
 * border-(--frame-panel-border-color). This means:
 *
 *   - variant="inverse" overrides those vars on Frame → all panels pick it up
 *   - <FramePanel className="bg-blue-50"> adds a direct utility on the element
 *     which wins over bg-(--frame-panel-bg) by Tailwind source order — no
 *     :not() or !important needed
 */
const frameVariants = cva(
  [
    "relative flex flex-col gap-(--frame-gap) rounded-(--frame-radius) bg-muted/50 px-(--frame-px) py-(--frame-py)",
    "(--radius-xl)] [--frame-radius:var(--radius-xl)]",
    "(--radius-none)] (--radius-2xl)] (--radius-lg)] (--radius-none)]",
    "[--frame-gap:--spacing(0.75)] [--frame-panel-footer-gap:--spacing(1)] [--frame-panel-header-gap:0rem] [--frame-px:--spacing(0.75)] [--frame-py:--spacing(0.75)]",
    "[--frame-panel-footer-px-adjust:0px] [--frame-panel-footer-py-adjust:0px] [--frame-panel-header-px-adjust:0px] [--frame-panel-header-py-adjust:0px] [--frame-panel-px-adjust:0px] [--frame-panel-py-adjust:0px]",
    "[--frame-panel-footer-px:calc(var(--frame-panel-footer-px-base)_+_var(--frame-panel-footer-px-adjust))] [--frame-panel-footer-py:calc(var(--frame-panel-footer-py-base)_+_var(--frame-panel-footer-py-adjust))] [--frame-panel-header-px:calc(var(--frame-panel-header-px-base)_+_var(--frame-panel-header-px-adjust))] [--frame-panel-header-py:calc(var(--frame-panel-header-py-base)_+_var(--frame-panel-header-py-adjust))] [--frame-panel-px:calc(var(--frame-panel-px-base)_+_var(--frame-panel-px-adjust))] [--frame-panel-py:calc(var(--frame-panel-py-base)_+_var(--frame-panel-py-adjust))]",
    "(1)] (1)] (1.25)] (1.5)] (1.5)] (0.5)] (1)] (1)]",
    // Default panel token values — overridden per-variant below
    "[--frame-border-color:var(--color-border)] [--frame-panel-bg:var(--color-card)] [--frame-panel-border-color:var(--color-border)]",
    // Concentric inner radius: the panel corner nests smoothly inside the frame
    // corner instead of matching it. The panel sits inset from the frame's outer
    // edge by the frame's 1px border + --frame-px padding, so its radius is
    // reduced by that same gap (radius − gap keeps the two arcs parallel). This
    // base value assumes the bordered default/inverse frame; `ghost` drops the
    // 1px border term and `dense` pins it back to the frame radius (its panels
    // are pulled flush to the edge).
    "[--frame-panel-radius:calc(var(--frame-radius)_-_var(--frame-px)_-_1px)]",
  ],
  {
    variants: {
      variant: {
        default: "border border-[var(--frame-border-color)] bg-clip-padding",
        inverse:
          "border border-[var(--frame-border-color)] bg-background bg-clip-padding [--frame-panel-bg:color-mix(in_oklch,var(--color-muted)_40%,transparent)]",
        // No frame border, so the panel is inset by --frame-px padding only.
        ghost: "[--frame-panel-radius:calc(var(--frame-radius)_-_var(--frame-px))]",
      },
      // Header/footer vertical rhythm is tighter than the panel body's, and
      // the gap widens as the frame grows: the bars read as chrome rather than
      // as another content block. py ladder is 0.5 / 1.5 / 2 / 2.5 against a
      // body py of 2 / 3.5 / 4 / 5. These vars are style-agnostic - no
      // style-*.css overrides them - so this single ladder drives all shadcn
      // styles. `px` is deliberately left level with the body so header,
      // content and footer stay left-aligned. `xs` holds at 0.5 (2px): it is
      // the practical floor, since anything lower stops reading as padding.
      spacing: {
        xs: "[--frame-panel-footer-px-base:--spacing(2)] [--frame-panel-footer-py-base:--spacing(0.5)] [--frame-panel-header-px-base:--spacing(2)] [--frame-panel-header-py-base:--spacing(0.5)] [--frame-panel-px-base:--spacing(2)] [--frame-panel-py-base:--spacing(2)]",
        sm: "[--frame-panel-footer-px-base:--spacing(3)] [--frame-panel-footer-py-base:--spacing(1.5)] [--frame-panel-header-px-base:--spacing(3)] [--frame-panel-header-py-base:--spacing(1.5)] [--frame-panel-px-base:--spacing(3)] [--frame-panel-py-base:--spacing(3.5)]",
        default:
          "[--frame-panel-footer-px-base:--spacing(4)] [--frame-panel-footer-py-base:--spacing(2)] [--frame-panel-header-px-base:--spacing(4)] [--frame-panel-header-py-base:--spacing(2)] [--frame-panel-px-base:--spacing(4)] [--frame-panel-py-base:--spacing(4)]",
        lg: "[--frame-panel-footer-px-base:--spacing(5)] [--frame-panel-footer-py-base:--spacing(2.5)] [--frame-panel-header-px-base:--spacing(5)] [--frame-panel-header-py-base:--spacing(2.5)] [--frame-panel-px-base:--spacing(5)] [--frame-panel-py-base:--spacing(5)]",
      },
      stacked: {
        true: [
          "gap-0 *:has-[+[data-slot=frame-panel]]:rounded-b-none",
          "*:has-[+[data-slot=frame-panel]]:before:hidden",
          "*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:rounded-t-none",
          "*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:border-t-0",
        ],
        false: [
          "data-[spacing=sm]:*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-0.5",
          "data-[spacing=default]:*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1",
          "data-[spacing=lg]:*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-2",
        ],
      },
      dense: {
        // Positional rules must stay as parent selectors — cannot be expressed via CSS vars.
        // Padding is 0 and panels are pulled flush to the frame edge (-mx-px), so
        // their corners align with the frame radius rather than nesting inside it.
        true: "gap-0 border-[var(--frame-border-color)] p-0 [--frame-panel-radius:var(--frame-radius)] [&_[data-slot=frame-panel]]:-mx-px [&_[data-slot=frame-panel]]:before:hidden [&_[data-slot=frame-panel]:last-child]:-mb-px [&:not(:has([data-slot=frame-panel-header]))_[data-slot=frame-panel]:is(:first-child)]:-mt-px",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      spacing: "default",
      stacked: false,
      dense: false,
    },
  }
);

function Frame({
  className,
  variant,
  spacing,
  stacked,
  dense,
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof frameVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(frameVariants({ variant, spacing, stacked, dense }), className),
      },
      props
    ),
    render,
    state: {
      slot: "frame",
      spacing,
    },
  });
}

function FramePanel({ className, fit, ...props }: React.ComponentProps<"div"> & { fit?: boolean }) {
  return (
    <div
      className={cn(
        // bg-(--frame-panel-bg) and border-(--frame-panel-border-color) consume the
        // CSS vars set by the Frame parent. Any explicit bg-* or border-* class passed
        // via className overrides these by Tailwind source order - no ! needed.
        "relative overflow-hidden rounded-(--frame-panel-radius) border border-(--frame-panel-border-color) bg-(--frame-panel-bg) bg-clip-padding shadow-xs",
        // `fit` sizes the panel to its content; otherwise it grows to fill the frame.
        !fit && "grow",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--frame-panel-radius)_-_1px)] before:shadow-black/5",
        "dark:bg-clip-border dark:before:shadow-white/5",
        "px-(--frame-panel-px) py-(--frame-panel-py)",
        className
      )}
      data-slot="frame-panel"
      {...props}
    />
  );
}

function FrameHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "flex flex-col gap-(--frame-panel-header-gap) px-(--frame-panel-header-px) py-(--frame-panel-header-py)",
        className
      )}
      data-slot="frame-panel-header"
      {...props}
    />
  );
}

function FrameTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm font-medium", className)} data-slot="frame-panel-title" {...props} />;
}

function FrameDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-sm text-muted-foreground", className)} data-slot="frame-panel-description" {...props} />
  );
}

function FrameFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return (
    <footer
      className={cn(
        "flex flex-col gap-(--frame-panel-footer-gap) px-(--frame-panel-footer-px) py-(--frame-panel-footer-py)",
        className
      )}
      data-slot="frame-panel-footer"
      {...props}
    />
  );
}

export { Frame, FramePanel, FrameHeader, FrameTitle, FrameDescription, FrameFooter, frameVariants };
