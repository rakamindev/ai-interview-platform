import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  fallbackPath?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  onClick?: () => void;
}

export const BackButton: React.FC<BackButtonProps> = ({
  fallbackPath = "/candidate",
  label = "Back",
  variant = "outline",
  className = "",
  onClick,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onClick) {
      onClick();
      return;
    }

    // Determine if browser history has an intra-app previous page
    if (window.history.state && typeof window.history.state.idx === "number" && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleBack}
      className={`inline-flex items-center gap-2 transition-all hover:-translate-x-0.5 ${className}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
};

export default BackButton;
