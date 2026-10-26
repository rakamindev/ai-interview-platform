import { useMemo, useState } from "react";
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { CUSTOM_ROLE_VALUE, ROLE_TITLE_MAX_LENGTH, ROLE_TITLE_OPTIONS } from "@/utils/roleTitles";

interface RoleTitleValues { role_title: string; role_title_custom?: string }
interface RoleTitleFieldProps { register: UseFormRegister<RoleTitleValues>; setValue: UseFormSetValue<RoleTitleValues>; watch: UseFormWatch<RoleTitleValues>; error?: string }
const standardRoles = ROLE_TITLE_OPTIONS.filter((t) => t !== CUSTOM_ROLE_VALUE);

export default function RoleTitleField({ register, setValue, watch, error }: RoleTitleFieldProps) {
  const roleTitle = watch("role_title");
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const filtered = useMemo(() => standardRoles.filter((t) => t.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const chooseStandard = (title: string) => { setValue("role_title", title, { shouldValidate: true }); setValue("role_title_custom", ""); setQuery(title); setListOpen(false); };
  const chooseCustom = () => { const text = query.trim(); setValue("role_title", CUSTOM_ROLE_VALUE, { shouldValidate: true }); setValue("role_title_custom", text); setQuery(text); setListOpen(false); };
  const clear = () => { setValue("role_title", "", { shouldValidate: true }); setValue("role_title_custom", ""); setQuery(""); setListOpen(true); };
  const handleChange = (value: string) => {
    if (value.length > ROLE_TITLE_MAX_LENGTH) return;
    setQuery(value); setListOpen(true);
    if (roleTitle) { setValue("role_title", "", { shouldValidate: true }); setValue("role_title_custom", ""); }
  };
  return <div className="space-y-1.5">
    <Label htmlFor="role_title_search">Role title <span className="text-destructive">*</span></Label>
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input id="role_title_search" aria-invalid={Boolean(error)} placeholder="Search or type a role title..." value={query} maxLength={ROLE_TITLE_MAX_LENGTH} onFocus={() => setListOpen(true)} onChange={(e) => handleChange(e.target.value)} className={`pl-9 pr-8 ${error ? "border-destructive focus-visible:ring-destructive" : ""}`} autoComplete="off" />
      {query && <button type="button" onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
    </div>
    {listOpen && <div className="max-h-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-md" role="listbox" aria-label="Role title options">
      {filtered.map((title) => <button key={title} type="button" role="option" onClick={() => chooseStandard(title)} className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent">{title}</button>)}
      {query.trim() && <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={chooseCustom}>Use “{query.trim()}” as custom role</Button>}
    </div>}
    <input type="hidden" {...register("role_title", { required: "Choose or enter a role title" })} />
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <input type="hidden" {...register("role_title_custom")} />
  </div>;
}
