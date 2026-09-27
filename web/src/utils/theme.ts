
export const DEFAULT_PRIMARY_COLOR = "#008C9B";

export const THEME_STORAGE_KEY = "rakamin_primary_color";

export const COLOR_PRESETS = [
  { name: "Rakamin Teal", color: "#008C9B" },
  { name: "Ocean Blue", color: "#2563EB" },
  { name: "Violet", color: "#7C3AED" },
  { name: "Emerald", color: "#059669" },
  { name: "Rose", color: "#E11D48" },
  { name: "Orange", color: "#EA580C" },
];

export function isValidHex(color: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

function hexToHsl(hex: string) {
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const difference = max - min;

  let hue = 0;
  let saturation = 0;

  const lightness = (max + min) / 2;

  if (difference !== 0) {
    saturation =
      difference /
      (1 - Math.abs(2 * lightness - 1));

    switch (max) {
      case red:
        hue =
          ((green - blue) / difference) % 6;
        break;

      case green:
        hue =
          (blue - red) / difference + 2;
        break;

      default:
        hue =
          (red - green) / difference + 4;
    }

    hue *= 60;
  }

  if (hue < 0) {
    hue += 360;
  }

  return `${Math.round(hue)} ${Math.round(
    saturation * 100
  )}% ${Math.round(lightness * 100)}%`;
}

export function applyPrimaryColor(hex: string) {
  if (!isValidHex(hex)) {
    return;
  }

  const root = document.documentElement;
  const hsl = hexToHsl(hex);

  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--ring", hsl);
}

export function savePrimaryColor(hex: string) {
  if (!isValidHex(hex)) {
    return;
  }

  const normalizedColor = hex.toUpperCase();

  localStorage.setItem(
    THEME_STORAGE_KEY,
    normalizedColor
  );

  applyPrimaryColor(normalizedColor);
}

export function loadPrimaryColor() {
  const saved = localStorage.getItem(
    THEME_STORAGE_KEY
  );

  return saved && isValidHex(saved)
    ? saved
    : DEFAULT_PRIMARY_COLOR;
}

export function initializeTheme() {
  applyPrimaryColor(loadPrimaryColor());
}

export function resetPrimaryColor() {
  localStorage.removeItem(THEME_STORAGE_KEY);
  applyPrimaryColor(DEFAULT_PRIMARY_COLOR);
}
