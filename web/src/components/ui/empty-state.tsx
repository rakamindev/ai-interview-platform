import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    icon?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    /** A button or link. Omit when there is genuinely nothing the user can do. */
    action?: React.ReactNode;
}

/** Nothing to show, said out loud. A blank region reads as a failure to diagnose. */
function EmptyState({
    icon,
    title,
    description,
    action,
    className,
    ...props
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center",
                className
            )}
            {...props}
        >
            {icon && <div className="text-muted-foreground" aria-hidden>{icon}</div>}
            <p className="text-sm font-medium">{title}</p>
            {description && (
                <p className="max-w-sm text-xs text-muted-foreground break-words">{description}</p>
            )}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

export { EmptyState };
