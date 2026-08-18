import { useState, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface TextAnswerInputProps {
  disabled: boolean;
  onSend: (text: string) => void;
}

export default function TextAnswerInput({ disabled, onSend }: TextAnswerInputProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-2 w-full">
      <Textarea
        aria-label="Type your answer"
        placeholder="Prefer to type?"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        className="min-h-[40px] max-h-40 resize-none overflow-y-auto break-words"
      />
      <Button size="sm" onClick={submit} disabled={disabled || !value.trim()}>
        <Send className="h-3.5 w-3.5 mr-1.5" />
        Send
      </Button>
    </div>
  );
}
