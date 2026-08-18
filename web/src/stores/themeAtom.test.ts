import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  readStoredTheme,
  applyTheme,
  storeTheme,
  nextTheme,
  type Theme,
} from "@/stores/themeAtom";

function osPrefersDark(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  vi.unstubAllGlobals();
});

describe("theme preference", () => {
  it("follows the operating system until someone chooses otherwise", () => {
    expect(readStoredTheme()).toBe("system");
  });

  it("remembers an explicit choice", () => {
    storeTheme("dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("ignores a stored value that is not a theme", () => {
    localStorage.setItem("theme", "neon");
    expect(readStoredTheme()).toBe("system");
  });

  it("survives storage being unavailable", () => {
    // Private browsing throws on both read and write. Losing the preference is
    // survivable; throwing on boot is not.
    const boom = () => {
      throw new Error("denied");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);

    expect(readStoredTheme()).toBe("system");
    expect(() => storeTheme("dark")).not.toThrow();

    vi.restoreAllMocks();
  });
});

describe("applyTheme", () => {
  it("puts the class Tailwind actually reads on the document", () => {
    // darkMode is configured as ["class"], so prefers-color-scheme alone does
    // nothing — this class is the only switch there is.
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("takes dark from the system when set to system", () => {
    osPrefersDark(true);
    applyTheme("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("takes light from the system too", () => {
    osPrefersDark(false);
    applyTheme("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("keeps an explicit light choice on a dark machine", () => {
    osPrefersDark(true);
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("nextTheme", () => {
  it("cycles through all three and returns", () => {
    const seen: Theme[] = [];
    let t: Theme = "system";
    for (let i = 0; i < 3; i++) {
      t = nextTheme(t);
      seen.push(t);
    }
    expect(seen).toEqual(["light", "dark", "system"]);
  });
});
