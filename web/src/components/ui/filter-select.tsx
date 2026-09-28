import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

/** A named filter with the same keyboard and positioning behavior as form selects. */
export function FilterSelect({ label, value, onValueChange, options, className, disabled }: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger aria-label={label} className={className}><SelectValue /></SelectTrigger>
      <SelectContent align="start">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
