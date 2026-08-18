import { useQuery } from "@tanstack/react-query";
import { Brain, Search } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

import type { SkillTaxonomy } from "../schemas/skill-taxonomy";
import { skillTaxonomyQueries } from "../queries/skill-taxonomy";

interface SkillPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (skill: SkillTaxonomy) => void;
}

export function SkillPicker({ open, onOpenChange, onSelect }: SkillPickerProps) {
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    ...skillTaxonomyQueries.list(),
    enabled: open,
  });

  const filtered =
    data?.skill_taxonomies.filter((item) => {
      return item.skill_label.toLowerCase().includes(query.toLowerCase());
    }) ?? [];

  const handleSelect = useCallback((value: SkillTaxonomy) => {
    onSelect(value);
    onOpenChange(false);
    setQuery("");
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add from B7 taxonomy</DialogTitle>
        </DialogHeader>

        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search skills..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </InputGroup>

        {isLoading ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Spinner />
              </EmptyMedia>
              <EmptyTitle>Processing your request</EmptyTitle>
              <EmptyDescription>Please wait while we process your request. Do not refresh the page.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Brain />
              </EmptyMedia>
              <EmptyTitle>No skills found</EmptyTitle>
              <EmptyDescription>We couldn't find any results for your search.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="max-h-64 flex-1 scroll-fade space-y-1 overflow-y-auto">
            {filtered.map((item) => (
              <Button
                key={item.skill_id}
                variant="ghost"
                type="button"
                className="w-full justify-start text-center"
                onClick={() => handleSelect(item)}
              >
                {item.skill_label}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
