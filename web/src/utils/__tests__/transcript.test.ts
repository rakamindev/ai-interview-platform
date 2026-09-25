import { describe, it, expect } from "vitest";
import { cleanTranscriptText } from "../transcript";

describe("cleanTranscriptText (Finding F-9: Leaked internal metadata prevention)", () => {
  it("strips [COVERAGE_MAP] tags and content from transcript text", () => {
    const rawText = "Hello! [COVERAGE_MAP]skills: react: covered[/COVERAGE_MAP] Tell me about your experience.";
    const cleaned = cleanTranscriptText(rawText);
    expect(cleaned).toBe("Hello!  Tell me about your experience.");
    expect(cleaned).not.toContain("[COVERAGE_MAP]");
  });

  it("strips raw JSON internal coverage metadata ({ skills: [...], discovered: [...] })", () => {
    const rawText = 'Welcome to the interview. {"skills": ["System Design"], "discovered": []} Could you explain Docker?';
    const cleaned = cleanTranscriptText(rawText);
    expect(cleaned).toBe("Welcome to the interview. Could you explain Docker?");
    expect(cleaned).not.toContain('"skills"');
    expect(cleaned).not.toContain('"discovered"');
  });

  it("strips internal control tokens like [TIME_CONTROL] and [SESSION RESUME]", () => {
    const rawText = "[TIME_CONTROL remaining=1200] Let's proceed to the next question. [SESSION RESUME]";
    const cleaned = cleanTranscriptText(rawText);
    expect(cleaned).toBe("Let's proceed to the next question.");
  });

  it("preserves legitimate candidate and interviewer dialogue unchanged", () => {
    const dialogue = "I have built distributed microservices using Ruby on Rails and React.";
    expect(cleanTranscriptText(dialogue)).toBe(dialogue);
  });
});
