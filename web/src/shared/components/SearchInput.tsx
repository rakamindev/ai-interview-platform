import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/shared/ui/input";

const DEBOUNCE_MS = 350;

interface SearchInputProps {
  placeholder: string;
  onSearch: (value: string) => void;
}

export default function SearchInput({ placeholder, onSearch }: SearchInputProps) {
  const [value, setValue] = useState("");
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    const id = setTimeout(() => onSearchRef.current(value), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [value]);

  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setValue("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
