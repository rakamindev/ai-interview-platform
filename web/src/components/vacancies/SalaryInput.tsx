import { useEffect, useState } from "react";
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SalaryField = "salary_min" | "salary_max";
interface SalaryValues { salary_min: string; salary_max: string }
interface SalaryInputProps {
  field: SalaryField;
  label: string;
  placeholder: string;
  register: UseFormRegister<SalaryValues>;
  setValue: UseFormSetValue<SalaryValues>;
  watch: UseFormWatch<SalaryValues>;
  error?: string;
  validate?: (value: string) => true | string;
}

export const formatIdrAmount = (value: string) => {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits ? new Intl.NumberFormat("id-ID").format(Number(digits)) : "";
};

export default function SalaryInput({ field, label, placeholder, register, setValue, watch, error, validate }: SalaryInputProps) {
  const value = watch(field) || "";
  const [displayValue, setDisplayValue] = useState(formatIdrAmount(value));
  useEffect(() => setDisplayValue(formatIdrAmount(value)), [value]);

  const onChange = (input: string) => {
    const raw = input.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    setValue(field, raw, { shouldValidate: true });
    setDisplayValue(formatIdrAmount(raw));
  };

  return <div className="space-y-1.5">
    <Label htmlFor={field}>{label} (IDR/month)</Label>
    <Input id={field} aria-invalid={Boolean(error)} className={error ? "border-destructive focus-visible:ring-destructive" : undefined} type="text" inputMode="numeric" placeholder={placeholder} value={displayValue} onChange={(event) => onChange(event.target.value)} />
    <input type="hidden" {...register(field, { validate })} />
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}
