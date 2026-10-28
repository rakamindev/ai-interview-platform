import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-teal-200/60 bg-teal-50/70 text-primary hover:bg-teal-100/60",
                secondary:
                    "border-amber-200/60 bg-amber-50/80 text-amber-800 hover:bg-amber-100/60",
                destructive:
                    "border-rose-200/60 bg-rose-50/80 text-rose-700 hover:bg-rose-100/60",
                outline:
                    "border-slate-200 bg-white text-slate-700 shadow-2xs",
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
