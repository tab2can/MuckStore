import { resolveThemeId, systemAccent } from "./systemAppearance";

export interface BuiltinTheme {
  id: string;
  name: string;
  tokens: Record<string, string>;
}

export const BUILTIN_THEMES: BuiltinTheme[] = [
  {
    id: "midnight",
    name: "Midnight",
    tokens: {
      bg: "#0b0d11",
      bgElevated: "#10131a",
      surface: "#161b24",
      surfaceHover: "#1d2330",
      border: "#2a3140",
      text: "#ece8e1",
      textMuted: "#9aa3b5",
      accent: "#d4a056",
      accentText: "#1a1408",
      danger: "#e06b5c",
      ok: "#6ecf9a",
      warning: "#e0c15a",
      radius: "12px",
      radiusSm: "8px",
      font: '"Segoe UI Variable Display", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
      blur: "16px",
      bgFill: "radial-gradient(120% 80% at 110% 0%, #d4a05633 0%, #0b0d11 58%)",
      elevatedFill: "none",
      surfaceFill: "none",
      accentFill: "none",
    },
  },
  {
    id: "daylight",
    name: "Daylight",
    tokens: {
      bg: "#f3eee6",
      bgElevated: "#fbf7f1",
      surface: "#ffffff",
      surfaceHover: "#efe8dc",
      border: "#d9d0c3",
      text: "#1c1814",
      textMuted: "#6b6358",
      accent: "#9a5b1a",
      accentText: "#fff8ef",
      danger: "#b42318",
      ok: "#1f7a4d",
      warning: "#9a6b00",
      radius: "12px",
      radiusSm: "8px",
      font: '"Segoe UI Variable Display", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
      blur: "16px",
      bgFill: "radial-gradient(120% 70% at 100% 0%, #9a5b1a2e 0%, #f3eee6 62%)",
      elevatedFill: "none",
      surfaceFill: "none",
      accentFill: "none",
    },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    tokens: {
      bg: "#000000",
      bgElevated: "#000000",
      surface: "#0a0a0a",
      surfaceHover: "#1a1a1a",
      border: "#ffffff",
      text: "#ffffff",
      textMuted: "#d0d0d0",
      accent: "#ffff00",
      accentText: "#000000",
      danger: "#ff6b6b",
      ok: "#66ff99",
      warning: "#ffd24d",
      radius: "4px",
      radiusSm: "2px",
      font: '"Segoe UI", system-ui, sans-serif',
      blur: "0px",
      bgFill: "none",
      elevatedFill: "none",
      surfaceFill: "none",
      accentFill: "none",
    },
  },
  {
    id: "amoled",
    name: "AMOLED",
    tokens: {
      bg: "#000000",
      bgElevated: "#050505",
      surface: "#0c0c0c",
      surfaceHover: "#161616",
      border: "#222222",
      text: "#f5f5f5",
      textMuted: "#8a8a8a",
      accent: "#d4a056",
      accentText: "#111111",
      danger: "#ff7a6e",
      ok: "#6ecf9a",
      warning: "#e0c15a",
      radius: "10px",
      radiusSm: "6px",
      font: '"Segoe UI Variable Display", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
      blur: "8px",
      bgFill: "none",
      elevatedFill: "none",
      surfaceFill: "none",
      accentFill: "none",
    },
  },
];

export const TOKEN_CSS: Record<string, string> = {
  bg: "--bg",
  bgElevated: "--bg-elevated",
  surface: "--surface",
  surfaceHover: "--surface-hover",
  border: "--border",
  borderStrong: "--border-strong",
  text: "--text",
  textMuted: "--text-muted",
  accent: "--accent",
  accentText: "--accent-text",
  danger: "--danger",
  ok: "--ok",
  warning: "--warning",
  radius: "--radius",
  radiusSm: "--radius-sm",
  font: "--font",
  blur: "--blur",
  bgFill: "--bg-fill",
  elevatedFill: "--elevated-fill",
  surfaceFill: "--surface-fill",
  accentFill: "--accent-fill",
  titlebarBg: "--titlebar-bg",
  titlebarFill: "--titlebar-fill",
  titlebarBorder: "--titlebar-border",
  titlebarText: "--titlebar-text",
  brand: "--brand",
  sidebarBg: "--sidebar-bg",
  sidebarFill: "--sidebar-fill",
  sidebarBorder: "--sidebar-border",
  navText: "--nav-text",
  navHoverBg: "--nav-hover-bg",
  navHoverText: "--nav-hover-text",
  navActiveBg: "--nav-active-bg",
  navActiveText: "--nav-active-text",
  navActiveBar: "--nav-active-bar",
  cardBorder: "--card-border",
  rowBg: "--row-bg",
  rowFill: "--row-fill",
  rowBorder: "--row-border",
  kicker: "--kicker",
  link: "--link",
  buttonBg: "--button-bg",
  buttonText: "--button-text",
  buttonBorder: "--button-border",
  buttonHover: "--button-hover",
  inputBg: "--input-bg",
  inputBorder: "--input-border",
};

const SLOT_FALLBACK: Record<string, string> = {
  titlebarBg: "bgElevated",
  titlebarFill: "elevatedFill",
  titlebarBorder: "border",
  titlebarText: "textMuted",
  brand: "accent",
  sidebarBg: "bgElevated",
  sidebarFill: "elevatedFill",
  sidebarBorder: "border",
  navText: "textMuted",
  navHoverBg: "surface",
  navHoverText: "text",
  navActiveText: "text",
  navActiveBar: "accent",
  cardBorder: "border",
  rowBg: "surface",
  rowFill: "surfaceFill",
  rowBorder: "border",
  kicker: "accent",
  link: "accent",
  buttonBg: "surface",
  buttonText: "text",
  buttonBorder: "border",
  buttonHover: "surfaceHover",
  inputBg: "bgElevated",
  inputBorder: "border",
  borderStrong: "border",
};

function mixHex(fg: string, bg: string, amount: number): string {
  const parse = (value: string) => {
    const h = value.trim().replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = Number.parseInt(full.slice(0, 6), 16);
    if (!Number.isFinite(n)) return { r: 128, g: 128, b: 128 };
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
  };
  const a = parse(fg);
  const b = parse(bg);
  const ch = (x: number, y: number) =>
    Math.round(x * amount + y * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(a.r, b.r)}${ch(a.g, b.g)}${ch(a.b, b.b)}`;
}

/** Copy palette tokens into per-surface slots so editing one region cannot pull another. */
export function expandThemeTokens(tokens: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...defaultThemeTokens(), ...tokens };
  for (const [slot, from] of Object.entries(SLOT_FALLBACK)) {
    if (!out[slot]) out[slot] = out[from] ?? "";
  }
  if (!tokens.navActiveBg) {
    out.navActiveBg = mixHex(out.accent ?? "#d4a056", out.sidebarBg || out.bgElevated || "#10131a", 0.22);
  }
  for (const key of Object.keys(TOKEN_CSS)) {
    if (key.endsWith("Fill") && (!out[key] || out[key] === "")) out[key] = "none";
  }
  return out;
}

export function defaultThemeTokens(): Record<string, string> {
  return { ...BUILTIN_THEMES[0].tokens };
}

export function tokensToStyle(tokens: Record<string, string>): Record<string, string> {
  const full = expandThemeTokens(tokens);
  const style: Record<string, string> = {};
  for (const [key, css] of Object.entries(TOKEN_CSS)) {
    const v = full[key];
    if (v) style[css] = v;
  }
  if (full.accent) style["--accent-dim"] = `color-mix(in srgb, ${full.accent} 18%, transparent)`;
  for (const css of Object.values(TOKEN_CSS)) {
    if (css.endsWith("-fill") && (!style[css] || style[css] === "")) style[css] = "none";
  }
  return style;
}

export function readAppliedTokens(): Record<string, string> {
  const s = getComputedStyle(document.documentElement);
  const out = defaultThemeTokens();
  for (const [key, css] of Object.entries(TOKEN_CSS)) {
    const v = s.getPropertyValue(css).trim();
    if (v) out[key] = v;
  }
  return out;
}

export function slugThemeId(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "tema";
}
export function applyTheme(
  themeId: string,
  extra?: Record<string, string>,
  accent?: string | null,
) {
  const resolved = themeId === "system" ? resolveThemeId("system") : themeId;
  const builtin = BUILTIN_THEMES.find((t) => t.id === resolved);
  const merged = { ...(builtin?.tokens ?? BUILTIN_THEMES[0].tokens), ...(themeId === "system" ? {} : (extra ?? {})) };
  if (themeId === "system" && resolved !== "high-contrast" && !accent) {
    const fromOs = systemAccent();
    if (fromOs) {
      merged.accent = fromOs.accent;
      merged.accentText = fromOs.accentText;
    }
  }
  if (accent) merged.accent = accent;
  const tokens = expandThemeTokens(merged);
  const root = document.documentElement;
  for (const [key, css] of Object.entries(TOKEN_CSS)) {
    const value = tokens[key];
    if (key.endsWith("Fill")) {
      root.style.setProperty(css, value && value !== "none" ? value : "none");
    } else if (value) {
      root.style.setProperty(css, value);
    }
  }
  root.setAttribute("data-theme", themeId === "system" ? `system-${resolved}` : resolved);
  const bg = tokens.bg ?? "";
  const light = resolved === "daylight" || (bg.startsWith("#") && luminance(bg) > 0.62);
  root.style.removeProperty("color-scheme");
  const host = document.getElementById("root");
  if (host) host.style.colorScheme = light ? "light" : "dark";
}

export function previewTokens(id: string, custom?: Record<string, string>): Record<string, string> {
  if (id === "system") {
    const resolved = resolveThemeId("system");
    const tokens = { ...(BUILTIN_THEMES.find((t) => t.id === resolved)?.tokens ?? BUILTIN_THEMES[0].tokens) };
    const fromOs = systemAccent();
    if (fromOs && resolved !== "high-contrast") {
      tokens.accent = fromOs.accent;
      tokens.accentText = fromOs.accentText;
    }
    return expandThemeTokens(tokens);
  }
  const builtin = BUILTIN_THEMES.find((t) => t.id === id);
  return expandThemeTokens({ ...(builtin?.tokens ?? BUILTIN_THEMES[0].tokens), ...(custom ?? {}) });
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length < 6) return 0;
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return 0;
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function applyChrome(
  density: string,
  fontScale: number,
  reducedMotion: boolean,
  mica: boolean,
  animations = true,
) {
  const root = document.documentElement;
  root.setAttribute("data-density", density);
  root.style.fontSize = `${16 * fontScale}px`;
  root.setAttribute("data-motion", reducedMotion || !animations ? "reduce" : "full");
  root.setAttribute("data-mica", mica ? "on" : "off");
}
