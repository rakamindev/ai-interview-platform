import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  withSubtitle?: boolean;
}

export default function BrandLogo({ className, size = "md", withSubtitle = false }: BrandLogoProps) {
  const logoHeights = {
    sm: "h-5 sm:h-6",
    md: "h-6 sm:h-7",
    lg: "h-8 sm:h-9",
  };

  return (
    <div className={cn("flex items-center gap-3 select-none", className)}>
      {/* Official Rakamin Wordmark / Logo */}
      <div className="flex items-center">
        <img
          src="/rakamin-logo.png"
          alt="Rakamin"
          className={cn("w-auto object-contain", logoHeights[size])}
        />
      </div>

      {/* Product Separator & AI Badge */}
      <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
        <span className="font-semibold text-xs sm:text-sm tracking-tight text-slate-900 flex items-center gap-1.5">
          <span className="bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent font-bold">
            AI Interview
          </span>
        </span>
        <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
          Enterprise
        </span>
      </div>

      {withSubtitle && (
        <span className="hidden md:inline text-[11px] text-muted-foreground ml-1">
          • Automated Competency Evaluation
        </span>
      )}
    </div>
  );
}
