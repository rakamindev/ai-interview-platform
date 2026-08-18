import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TextAnswerInput from "@/components/interview/TextAnswerInput";

describe("TextAnswerInput (F19 typed-answer fallback)", () => {
  it("sends the trimmed text and clears the field when Send is clicked", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<TextAnswerInput disabled={false} onSend={onSend} />);

    const textbox = screen.getByRole("textbox", { name: /type your answer/i });
    await user.type(textbox, "  I'd use a message queue.  ");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(onSend).toHaveBeenCalledWith("I'd use a message queue.");
    expect(textbox).toHaveValue("");
  });

  it("sends on Enter without a newline, but allows Shift+Enter to add a newline", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<TextAnswerInput disabled={false} onSend={onSend} />);

    const textbox = screen.getByRole("textbox", { name: /type your answer/i });
    await user.type(textbox, "line one{Shift>}{Enter}{/Shift}line two{Enter}");

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("line one\nline two");
  });

  it("does not send empty or whitespace-only input", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<TextAnswerInput disabled={false} onSend={onSend} />);

    await user.click(screen.getByRole("button", { name: /send/i }));
    await user.type(screen.getByRole("textbox", { name: /type your answer/i }), "   ");
    await user.keyboard("{Enter}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables the field and Send button while the AI is speaking", () => {
    render(<TextAnswerInput disabled={true} onSend={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: /type your answer/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("accepts and sends a very long answer (5000 chars) intact", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<TextAnswerInput disabled={false} onSend={onSend} />);
    const longText = "a".repeat(5000);

    await user.click(screen.getByRole("textbox", { name: /type your answer/i }));
    await user.paste(longText);
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(onSend).toHaveBeenCalledWith(longText);
  });
});
