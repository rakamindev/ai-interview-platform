import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface HeroBannerProps {
  badgeText?: string;
  title: string;
  highlightText?: string;
  subtitle: string;
  bulletPoints?: string[];
  primaryAction?: {
    label: string;
    onClick?: () => void;
    icon?: ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    icon?: ReactNode;
  };
  imageSrc?: string;
  imageAlt?: string;
  imageFloatingBadge?: {
    title: string;
    subtitle: string;
  };
  variant?: "card" | "wide";
}

export default function HeroBanner({
  badgeText = "⭐️ AI-Powered Talent Evaluation Platform",
  title,
  highlightText,
  subtitle,
  bulletPoints = [
    "Wawancara Suara AI Berbasis Taksonomi Kompetensi B7",
    "Pemetaan Otomatis 4 Tingkat Coverage (0% s/d 100%)",
    "Analisis Fit/Gap Objektif dengan Human Override Governance",
  ],
  primaryAction,
  secondaryAction,
  imageSrc = "/images/hero-rakamin-logo.png",
  imageAlt = "Rakamin Talent",
  imageFloatingBadge = {
    title: "100% Objektif",
    subtitle: "UU PDP Compliant",
  },
  variant = "card",
}: HeroBannerProps) {
  if (variant === "wide") {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#01959f] via-[#01808a] to-[#016870] text-white p-6 sm:p-10 shadow-lg shadow-teal-900/10 mb-6">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-2">
          {badgeText && (
            <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs mb-1">
              {badgeText}
            </span>
          )}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {title}{" "}
            {highlightText && <span className="text-[#fbc036]">{highlightText}</span>}
          </h1>
          <p className="text-sm sm:text-base text-teal-50 font-normal leading-relaxed">
            {subtitle}
          </p>

          {primaryAction && (
            <div className="pt-4 flex items-center gap-3">
              <Button
                variant="cta"
                onClick={primaryAction.onClick}
                className="shadow-md"
              >
                {primaryAction.icon}
                {primaryAction.label}
              </Button>
              {secondaryAction && (
                <Button
                  variant="outline"
                  onClick={secondaryAction.onClick}
                  className="bg-white/10 text-white border-white/30 hover:bg-white/20"
                >
                  {secondaryAction.icon}
                  {secondaryAction.label}
                </Button>
              )}
            </div>
          )}
        </div>

        {imageSrc && (
          <div className="hidden lg:block absolute right-4 bottom-0 top-0 w-80 pointer-events-none">
            <img
              src={imageSrc}
              alt={imageAlt}
              className="h-full w-full object-contain object-bottom drop-shadow-xl"
            />
          </div>
        )}
      </div>
    );
  }

  // Card variant (refined, spacious typography with frameless large corner image)
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full relative overflow-hidden rounded-2xl sm:rounded-3xl border border-teal-100/90 bg-gradient-to-r from-teal-50/80 via-white to-amber-50/40 p-4 sm:p-7 lg:p-8 shadow-xs mb-6 sm:min-h-[380px] flex flex-col justify-center"
    >
      {/* Decorative ambient radial orbs */}
      <div className="absolute top-[-25%] right-[-10%] w-[280px] h-[280px] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-25%] left-[-10%] w-[240px] h-[240px] rounded-full bg-[#fbc036]/15 blur-3xl pointer-events-none" />

      {/* Main Content Layout */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left Column: Headlines, bullets chips, and CTAs (Strictly constrained so it never touches image) */}
        <div className="flex-1 space-y-3.5 min-w-0 w-full sm:max-w-[55%] md:max-w-[56%] lg:max-w-[58%] xl:max-w-[60%] z-20">
          {/* Badge Pill */}
          {badgeText && (
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#01808a] bg-teal-100/70 border border-teal-200/80 px-3 py-1 rounded-full shadow-2xs">
                {badgeText}
              </span>
            </div>
          )}

          {/* Heading Title */}
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900 leading-tight">
            {title}{" "}
            {highlightText && (
              <span className="text-[#01959f] underline decoration-[#fbc036] decoration-2 underline-offset-4">
                {highlightText}
              </span>
            )}
          </h1>

          {/* Subtitle with generous line height and max width */}
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
            {subtitle}
          </p>

          {/* Checklist chips with comfortable breathing room */}
          {bulletPoints && bulletPoints.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 pt-1 w-full">
              {bulletPoints.map((point, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-slate-700 bg-white/90 border border-slate-200/80 px-2.5 sm:px-3 py-1 rounded-xl shadow-2xs max-w-full"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#01959f] shrink-0" />
                  <span className="break-words">{point}</span>
                </span>
              ))}
            </div>
          )}

          {/* CTA Buttons */}
          {(primaryAction || secondaryAction) && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 w-full sm:w-auto">
              {primaryAction && (
                <Button
                  variant="cta"
                  size="sm"
                  onClick={primaryAction.onClick}
                  className="rounded-xl px-4 py-2 font-bold text-xs shadow-sm h-9.5 w-full sm:w-auto justify-center"
                >
                  {primaryAction.icon}
                  <span>{primaryAction.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}

              {secondaryAction && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={secondaryAction.onClick}
                  className="rounded-xl px-4 py-2 font-semibold text-xs bg-white/95 border-slate-200 hover:bg-slate-50 text-slate-700 h-9.5 w-full sm:w-auto justify-center"
                >
                  {secondaryAction.icon}
                  <span>{secondaryAction.label}</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Large frameless image anchored seamlessly to the right corner */}
      {imageSrc && (
        <div className="hidden sm:block absolute right-0 top-0 bottom-0 w-48 md:w-64 lg:w-80 xl:w-[400px] pointer-events-none select-none overflow-hidden">
          {imageSrc.includes("hero-rakamin-logo") || imageSrc.includes("rakamin-logo") ? (
            <div className="h-full w-full flex items-end justify-end">
              <img
                src={imageSrc}
                alt={imageAlt}
                className="h-[108%] max-h-[290px] sm:max-h-[310px] lg:max-h-[350px] w-auto object-contain object-bottom select-none"
              />
            </div>
          ) : (
            <div className="relative h-full w-full">
              {/* Soft gradient fade on the left edge so photo blends effortlessly into the card */}
              <div className="absolute inset-y-0 left-0 w-24 md:w-36 bg-gradient-to-r from-white via-white/70 to-transparent z-10" />
              <img
                src={imageSrc}
                alt={imageAlt}
                className="h-full w-full object-cover object-center"
              />
              {imageFloatingBadge && (
                <div className="absolute bottom-3 right-4 z-20 bg-white/95 backdrop-blur-md rounded-xl py-1 px-3 border border-slate-200/80 shadow-md flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#01959f] text-white flex items-center justify-center font-bold text-[8px] shrink-0">
                    ✓
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    {imageFloatingBadge.title}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
