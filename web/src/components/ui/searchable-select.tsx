import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check, X, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
  className?: string;
  icon?: React.ReactNode;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select option",
  allLabel = "All Skills",
  className,
  icon,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase().trim())
  );

  const selectedLabel = value === "all" ? `${allLabel} (${options.length})` : value;

  return (
    <div ref={containerRef} className={cn("relative w-full sm:w-60", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full h-9 px-3 text-sm bg-slate-50/50 hover:bg-slate-100/70 border border-slate-200 rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs",
          isOpen && "ring-2 ring-primary/20 border-primary"
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {icon || <Layers className="h-3.5 w-3.5 text-primary shrink-0" />}
          <span className="truncate text-slate-800 font-medium">{selectedLabel}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {value !== "all" && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange("all");
              }}
              className="p-0.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
              title="Clear skill filter"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[240px] max-w-xs bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Search Input Bar */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search skill name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
            {/* "All" Option */}
            {!search && (
              <button
                type="button"
                onClick={() => {
                  onChange("all");
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer",
                  value === "all"
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-slate-700 hover:bg-slate-100 font-medium"
                )}
              >
                <span>{allLabel} ({options.length})</span>
                {value === "all" && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No skill matching "{search}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value.toLowerCase() === opt.toLowerCase();
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer",
                      isSelected
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-slate-700 hover:bg-slate-100 font-medium"
                    )}
                  >
                    <span className="truncate pr-2">{opt}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
