import { getLocale, locales, setLocale } from "@/paraglide/runtime.js";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { CheckIcon, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const localeLabels: Record<string, string> = { en: "English", id: "Indonesian" };

export default function LanguageSwitcher() {
  const currentLocale = getLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {locales.map((locale) => {
          const isActive = currentLocale === locale;
          return (
            <DropdownMenuItem
              key={locale}
              onClick={() => setLocale(locale)}
              className={cn("flex items-center justify-between", isActive && "bg-muted/50")}
            >
              {localeLabels[locale]}
              {isActive && <CheckIcon className="h-3 w-3" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
