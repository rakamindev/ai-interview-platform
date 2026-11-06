import { useCallback, useEffect, useState } from "react";
import type { CandidateLanguage } from "@/lib/candidateAccess";

const STORAGE_KEY = "candidate_language";

function detectLanguage(): CandidateLanguage {
  if (typeof window === "undefined") return "en";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "id") return stored;

  // Indonesian candidates overwhelmingly run browsers with an `id` locale.
  // Falling back to English keeps the product usable for everyone else.
  return navigator.language?.toLowerCase().startsWith("id") ? "id" : "en";
}

export function useCandidateLanguage(): [CandidateLanguage, (language: CandidateLanguage) => void] {
  const [language, setLanguage] = useState<CandidateLanguage>(detectLanguage);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const change = useCallback((next: CandidateLanguage) => setLanguage(next), []);
  return [language, change];
}

export default function LanguageToggle({
  language,
  onChange,
}: {
  language: CandidateLanguage;
  onChange: (language: CandidateLanguage) => void;
}) {
  return (
    <div
      className="inline-flex items-center rounded-full border bg-background p-0.5 text-xs"
      role="group"
      aria-label="Interview language"
    >
      {(["en", "id"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={language === value}
          className={
            "rounded-full px-2.5 py-1 transition-colors " +
            (language === value
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {value === "en" ? "English" : "Bahasa"}
        </button>
      ))}
    </div>
  );
}
