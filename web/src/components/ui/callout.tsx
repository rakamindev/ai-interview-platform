import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Info, XCircle, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

const calloutVariants = cva(
    "flex gap-2.5 rounded-md border px-3 py-2 text-xs [&_p]:leading-relaxed",
    {
        variants: {
            variant: {
                info: "border-border bg-muted/50 text-muted-foreground",
                warning: "border-amber-200 bg-amber-50 text-amber-900",
                error: "border-destructive/40 bg-destructive/5 text-destructive",
                muted: "border-dashed border-border bg-muted/40 text-muted-foreground",
            },
        },
        defaultVariants: { variant: "info" },
    }
);

const ICONS = {
    info: Info,
    warning: AlertTriangle,
    error: XCircle,
    muted: CircleDashed,
} as const;

// `title` is widened to ReactNode, so the DOM's string-only `title` is omitted.
export interface CalloutProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof calloutVariants> {
    title?: React.ReactNode;
}

function Callout({
    className,
    variant = "info",
    title,
    children,
    ...props
}: CalloutProps) {
    const Icon = ICONS[variant ?? "info"];

    return (
        <div
            className={cn(calloutVariants({ variant }), className)}
            role={variant === "error" ? "alert" : "status"}
            {...props}
        >
            <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
            {/* min-w-0 lets long unbroken strings wrap instead of stretching the row. */}
            <div className="min-w-0 space-y-1">
                {title && <p className="font-medium">{title}</p>}
                {children && <div className="break-words">{children}</div>}
            </div>
        </div>
    );
}

export { Callout, calloutVariants };
