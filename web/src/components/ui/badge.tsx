import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                neutral: "border-border bg-muted/60 text-muted-foreground",
                success: "border-success/20 bg-success/10 text-success",
                warning: "border-warning/20 bg-warning/10 text-warning",
                danger: "border-destructive/20 bg-destructive/10 text-destructive",
                info: "border-info/20 bg-info/10 text-info",
                default:
                    "border-transparent bg-muted text-foreground",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-destructive/20 bg-destructive/10 text-destructive",
                outline: "text-foreground",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
