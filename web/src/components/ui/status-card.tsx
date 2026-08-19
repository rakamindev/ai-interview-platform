import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusCardVariants = cva(
    "rounded-lg bg-card text-card-foreground shadow-sm border-y border-r border-l-4",
    {
        variants: {
            tone: {
                primary: "border-y-border border-r-border border-l-primary",
                success: "border-y-border border-r-border border-l-green-500",
                warning: "border-y-border border-r-border border-l-amber-500",
                destructive: "border-y-border border-r-border border-l-destructive",
                neutral: "border-y-border border-r-border border-l-border",
            },
        },
        defaultVariants: {
            tone: "neutral",
        },
    }
);

export interface StatusCardProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusCardVariants> { }

const StatusCard = React.forwardRef<HTMLDivElement, StatusCardProps>(
    ({ className, tone, ...props }, ref) => (
        <div ref={ref} className={cn(statusCardVariants({ tone }), className)} {...props} />
    )
);
StatusCard.displayName = "StatusCard";

export { StatusCard, statusCardVariants };
