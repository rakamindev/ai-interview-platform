import { useEffect, useMemo, useState } from "react";
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X } from "lucide-react";

interface LocationValues { location: string }
interface LocationFieldProps { register: UseFormRegister<LocationValues>; setValue: UseFormSetValue<LocationValues>; watch: UseFormWatch<LocationValues> }

const LOCATION_OPTIONS = [
  "Jakarta", "Tangerang", "South Tangerang", "Bekasi", "Depok", "Bogor", "Bandung", "Surabaya",
  "Yogyakarta", "Semarang", "Medan", "Makassar", "Bali", "Indonesia",
];

export default function LocationField({ register, setValue, watch }: LocationFieldProps) {
  const location = watch("location") || "";
  const [query, setQuery] = useState(location);
  const [listOpen, setListOpen] = useState(false);
  useEffect(() => setQuery(location), [location]);
  const filtered = useMemo(
    () => LOCATION_OPTIONS.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );
  const choose = (value: string) => { setValue("location", value, { shouldValidate: true }); setQuery(value); setListOpen(false); };
  const clear = () => { setValue("location", "", { shouldValidate: true }); setQuery(""); setListOpen(true); };

  return <div className="space-y-1.5">
    <Label htmlFor="location_search">Location</Label>
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input id="location_search" placeholder="Search or enter a location..." value={query} maxLength={255} autoComplete="off" className="pl-9 pr-8" onFocus={() => setListOpen(true)} onChange={(event) => { const value = event.target.value; setQuery(value); setValue("location", value, { shouldValidate: true }); setListOpen(true); }} />
      {query && <button type="button" onClick={clear} aria-label="Clear location" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
    </div>
    {listOpen && <div className="max-h-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-md" role="listbox" aria-label="Location options">
      {filtered.map((option) => <button key={option} type="button" role="option" onClick={() => choose(option)} className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent">{option}</button>)}
      {query.trim() && !LOCATION_OPTIONS.some((option) => option.toLowerCase() === query.trim().toLowerCase()) && <p className="px-2 py-1.5 text-xs text-muted-foreground">Use “{query.trim()}” as custom location</p>}
    </div>}
    <input type="hidden" {...register("location")} />
  </div>;
}
