import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  label: string;
  value: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Type...",
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [open]);

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes((value ?? "").toLowerCase())
  );

  useEffect(() => {
    if (open && highlightIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex, open]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlightIndex((prev) =>
        filtered.length === 0 ? -1 : prev < filtered.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        filtered.length === 0 ? -1 : prev > 0 ? prev - 1 : filtered.length - 1
      );
    } else if (e.key === "Enter") {
      if (open && highlightIndex >= 0 && filtered[highlightIndex]) {
        e.preventDefault();
        handleSelect(filtered[highlightIndex].value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-md">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No suggestions
            </p>
          ) : (
            <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
              {filtered.map((opt, index) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(opt.value);
                    }}
                    onMouseEnter={() => setHighlightIndex(index)}
                    className={cn(
                      "flex w-full items-center px-3 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground",
                      (value === opt.value || index === highlightIndex) &&
                        "bg-accent text-accent-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
