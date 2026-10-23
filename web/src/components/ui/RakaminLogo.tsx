import React from "react";
import { cn } from "@/lib/utils";

interface RakaminLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtitle?: string;
}

export const RakaminLogo: React.FC<RakaminLogoProps> = ({
  className,
  size = "md",
  showText = true,
  subtitle = "AI Assessment",
}) => {
  const iconSizes = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      {/* Rakamin Vector Brand Icon */}
      <div className={cn("relative flex items-center justify-center rounded-xl bg-gradient-to-br from-[#01959F] to-[#007E88] shadow-sm p-1.5 text-white flex-shrink-0", iconSizes[size])}>
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* R Shape with Golden Dynamic Dot */}
          <path
            d="M10 8C10 6.89543 10.8954 6 12 6H24C28.4183 6 32 9.58172 32 14C32 17.5458 29.6946 20.5539 26.5057 21.6019L32.2426 31.7901C32.7937 32.7699 32.0886 34 30.9616 34H26.3431C25.68 34 25.0601 33.646 24.7171 33.0744L19.5 24H16V32C16 33.1046 15.1046 34 14 34H12C10.8954 34 10 33.1046 10 32V8Z"
            fill="currentColor"
          />
          <path
            d="M16 12V18H23C24.6569 18 26 16.6569 26 15C26 13.3431 24.6569 12 23 12H16Z"
            fill="#01959F"
          />
          {/* Rakamin Golden Star/Dot Accent */}
          <circle cx="28" cy="10" r="3.5" fill="#FBC037" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={cn("font-extrabold tracking-tight text-foreground font-sans", textSizes[size])}>
              Rakamin
            </span>
          </div>
          {subtitle && (
            <span className="text-[11px] font-medium text-muted-foreground leading-none -mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default RakaminLogo;
