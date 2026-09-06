import { describe, it, expect } from "vitest";
import { formatEvidenceQuote, stripWrappingQuotes } from "./evidence";

describe("stripWrappingQuotes", () => {
  it("removes the straight quotes the generator wraps around every quote", () => {
    expect(stripWrappingQuotes('"I framed it as a performance risk"')).toBe(
      "I framed it as a performance risk",
    );
  });

  it("leaves an unquoted value untouched", () => {
    expect(stripWrappingQuotes("I framed it as a performance risk")).toBe(
      "I framed it as a performance risk",
    );
  });

  it("removes only one layer, so a quotation inside a quotation survives", () => {
    expect(stripWrappingQuotes('""nobody reviews this" was the actual answer"')).toBe(
      '"nobody reviews this" was the actual answer',
    );
  });

  it("keeps interior quotation marks that are not a wrapping pair", () => {
    expect(stripWrappingQuotes('he said "no" and left')).toBe('he said "no" and left');
  });

  it("strips only the outermost pair when two different pairs are nested", () => {
    // Coverage gap found by a seeded fault test: removing the `break` from the
    // stripping loop left every same-pair case identical, because the loop
    // advances to a *different* pair rather than retrying the same one. Only a
    // mixed nesting distinguishes "one layer" from "one layer per pair type",
    // and nothing asserted it — so a real behaviour change passed unnoticed.
    expect(stripWrappingQuotes('"\u201Cwe profiled it first\u201D"')).toBe(
      "\u201Cwe profiled it first\u201D",
    );
  });

  it("recognises curly quotes", () => {
    expect(stripWrappingQuotes("“we profiled it first”")).toBe("we profiled it first");
  });

  it("trims surrounding whitespace", () => {
    expect(stripWrappingQuotes('   "we profiled it first"  ')).toBe("we profiled it first");
  });

  it("does not mangle a lone quotation mark", () => {
    expect(stripWrappingQuotes('"')).toBe('"');
  });

  it("returns an empty string for an empty quote", () => {
    expect(stripWrappingQuotes("")).toBe("");
    expect(stripWrappingQuotes('""')).toBe("");
  });
});

describe("formatEvidenceQuote", () => {
  it("renders exactly one pair of typographic quotes", () => {
    expect(formatEvidenceQuote('"I framed it as a performance risk"')).toBe(
      "“I framed it as a performance risk”",
    );
  });

  it("adds quotes to a value that arrives without them", () => {
    expect(formatEvidenceQuote("we profiled it first")).toBe("“we profiled it first”");
  });

  it("renders nothing rather than an empty pair of quotes", () => {
    expect(formatEvidenceQuote('""')).toBe("");
    expect(formatEvidenceQuote("   ")).toBe("");
  });
});
