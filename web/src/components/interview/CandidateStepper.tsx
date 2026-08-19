import React from "react";
import { Check, ShieldCheck, Headphones, Radio, Award } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepKey = "welcome" | "device_check" | "live" | "complete";

interface Step {
  key: StepKey;
  label: string;
  icon: React.ElementType;
}

const steps: Step[] = [
  { key: "welcome", label: "Welcome", icon: ShieldCheck },
  { key: "device_check", label: "Device Check", icon: Headphones },
  { key: "live", label: "Interview", icon: Radio },
  { key: "complete", label: "Complete", icon: Award },
];

interface CandidateStepperProps {
  currentStep: StepKey;
  labels?: {
    welcome: string;
    deviceCheck: string;
    live: string;
    complete: string;
  };
}

export function CandidateStepper({ currentStep, labels }: CandidateStepperProps) {
  const stepIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="w-full max-w-xl mx-auto px-2 py-3">
      <div className="flex items-center justify-between relative">
        {/* Connecting line */}
        <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-0.5 bg-muted z-0" />
        <div
          className="absolute top-1/2 left-4 -translate-y-1/2 h-0.5 bg-primary transition-all duration-500 z-0"
          style={{
            width: `${Math.max(0, Math.min(100, (stepIndex / (steps.length - 1)) * 100))}%`,
          }}
        />

        {steps.map((step, idx) => {
          const isDone = idx < stepIndex;
          const isCurrent = idx === stepIndex;
          const label = labels ? (labels as any)[step.key === "device_check" ? "deviceCheck" : step.key] : step.label;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex flex-col items-center relative z-10">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 border-2",
                  isDone && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "bg-background border-primary text-primary shadow-sm ring-4 ring-primary/20",
                  !isDone && !isCurrent && "bg-muted border-border text-muted-foreground"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-[11px] font-medium transition-colors hidden sm:block",
                  isCurrent && "text-primary font-semibold",
                  isDone && "text-foreground",
                  !isDone && !isCurrent && "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
