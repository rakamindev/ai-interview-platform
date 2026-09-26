import { describe, expect, it } from "vitest";
import { readLastVisit, rememberVisit } from "./lastVisit";

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) } as Storage;
};

describe("last visit", () => {
  it("remembers when this device last looked", () => {
    const storage = memory();
    rememberVisit(new Date("2026-09-26T08:00:00Z"), storage);
    expect(readLastVisit(storage)).toBe("2026-09-26T08:00:00.000Z");
  });

  it("returns nothing on a first visit, or when storage is blocked", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } as unknown as Storage;
    expect(readLastVisit(memory())).toBeNull();
    expect(readLastVisit(blocked)).toBeNull();
    expect(() => rememberVisit(new Date(), blocked)).not.toThrow();
  });
});
