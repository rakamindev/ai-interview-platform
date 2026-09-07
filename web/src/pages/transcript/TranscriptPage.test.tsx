import { highlightParts } from "./TranscriptPage";

// The portfolio presents quotes as the evidence behind a level. Until now there
// was no way to find one in the transcript, so an assessor asked to defend a
// rating had to scroll and hope. This is the function that makes a pasted quote
// findable, and getting it wrong would either miss the match or mangle the
// candidate's words.
describe("highlightParts", () => {
  it("leaves the text whole when nothing is being searched for", () => {
    expect(highlightParts("We profiled the dashboard.", "")).toEqual([
      { text: "We profiled the dashboard.", match: false },
    ]);
  });

  it("treats whitespace as no search at all", () => {
    expect(highlightParts("We profiled the dashboard.", "   ")).toEqual([
      { text: "We profiled the dashboard.", match: false },
    ]);
  });

  it("splits around a match", () => {
    expect(highlightParts("We profiled the dashboard.", "profiled")).toEqual([
      { text: "We ", match: false },
      { text: "profiled", match: true },
      { text: " the dashboard.", match: false },
    ]);
  });

  it("matches regardless of case, and keeps the original casing", () => {
    const parts = highlightParts("We Profiled it.", "profiled");

    expect(parts.find((p) => p.match)?.text).toBe("Profiled");
  });

  it("finds every occurrence, not just the first", () => {
    expect(highlightParts("redux, then redux again", "redux").filter((p) => p.match)).toHaveLength(2);
  });

  it("handles a match at the very start", () => {
    expect(highlightParts("Redux was the problem", "Redux")[0]).toEqual({ text: "Redux", match: true });
  });

  it("handles a match at the very end", () => {
    const parts = highlightParts("the problem was Redux", "Redux");

    expect(parts[parts.length - 1]).toEqual({ text: "Redux", match: true });
  });

  it("reports no match rather than inventing one", () => {
    expect(highlightParts("We profiled it.", "kubernetes")).toEqual([
      { text: "We profiled it.", match: false },
    ]);
  });

  // A quote pasted straight out of a portfolio card carries punctuation and
  // regex-significant characters. Treating it as a pattern rather than a
  // literal would either throw or match the wrong thing.
  it("treats a pasted quote as literal text, not a pattern", () => {
    const text = 'He said "we cut re-renders (by 60%)" in the review.';
    const parts = highlightParts(text, '"we cut re-renders (by 60%)"');

    expect(parts.find((p) => p.match)?.text).toBe('"we cut re-renders (by 60%)"');
  });

  it("never loses or duplicates a character", () => {
    const text = "Redux, then local state, then Redux again.";
    const parts = highlightParts(text, "redux");

    expect(parts.map((p) => p.text).join("")).toBe(text);
  });
});
