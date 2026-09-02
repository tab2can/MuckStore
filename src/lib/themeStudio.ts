import { defaultThemeTokens, expandThemeTokens } from "./themes";

export type TokenKind = "color" | "paint" | "radius" | "blur" | "font";

export interface TokenField {
  id: string;
  kind: TokenKind;
  group: string;
  fillKey?: string;
}

export const TOKEN_GROUPS = [
  "window",
  "titlebar",
  "sidebar",
  "nav",
  "cards",
  "rows",
  "type",
  "buttons",
  "badges",
  "panels",
  "shape",
] as const;

export type TokenGroup = (typeof TOKEN_GROUPS)[number];

export const FILL_KEYS = [
  "bgFill",
  "titlebarFill",
  "sidebarFill",
  "elevatedFill",
  "surfaceFill",
  "rowFill",
  "accentFill",
] as const;

export const TOKEN_FIELDS: TokenField[] = [
  { id: "bg", kind: "paint", fillKey: "bgFill", group: "window" },

  { id: "titlebarBg", kind: "paint", fillKey: "titlebarFill", group: "titlebar" },
  { id: "titlebarBorder", kind: "color", group: "titlebar" },
  { id: "titlebarText", kind: "color", group: "titlebar" },
  { id: "brand", kind: "color", group: "titlebar" },

  { id: "sidebarBg", kind: "paint", fillKey: "sidebarFill", group: "sidebar" },
  { id: "sidebarBorder", kind: "color", group: "sidebar" },

  { id: "navText", kind: "color", group: "nav" },
  { id: "navHoverBg", kind: "color", group: "nav" },
  { id: "navHoverText", kind: "color", group: "nav" },
  { id: "navActiveBg", kind: "color", group: "nav" },
  { id: "navActiveText", kind: "color", group: "nav" },
  { id: "navActiveBar", kind: "color", group: "nav" },

  { id: "surface", kind: "paint", fillKey: "surfaceFill", group: "cards" },
  { id: "surfaceHover", kind: "color", group: "cards" },
  { id: "cardBorder", kind: "color", group: "cards" },
  { id: "radius", kind: "radius", group: "cards" },

  { id: "rowBg", kind: "paint", fillKey: "rowFill", group: "rows" },
  { id: "rowBorder", kind: "color", group: "rows" },

  { id: "text", kind: "color", group: "type" },
  { id: "textMuted", kind: "color", group: "type" },
  { id: "kicker", kind: "color", group: "type" },
  { id: "link", kind: "color", group: "type" },
  { id: "font", kind: "font", group: "type" },

  { id: "accent", kind: "paint", fillKey: "accentFill", group: "buttons" },
  { id: "accentText", kind: "color", group: "buttons" },
  { id: "buttonBg", kind: "color", group: "buttons" },
  { id: "buttonText", kind: "color", group: "buttons" },
  { id: "buttonBorder", kind: "color", group: "buttons" },
  { id: "buttonHover", kind: "color", group: "buttons" },
  { id: "danger", kind: "color", group: "buttons" },

  { id: "ok", kind: "color", group: "badges" },
  { id: "warning", kind: "color", group: "badges" },

  { id: "bgElevated", kind: "paint", fillKey: "elevatedFill", group: "panels" },
  { id: "inputBg", kind: "color", group: "panels" },
  { id: "inputBorder", kind: "color", group: "panels" },
  { id: "border", kind: "color", group: "panels" },
  { id: "borderStrong", kind: "color", group: "panels" },

  { id: "radiusSm", kind: "radius", group: "shape" },
  { id: "blur", kind: "blur", group: "shape" },
];

export const STUDIO_FONTS = [
  { id: '"Segoe UI Variable Display", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif', label: "Segoe UI Variable" },
  { id: '"Segoe UI", system-ui, sans-serif', label: "Segoe UI" },
  { id: '"Cascadia Code", "Cascadia Mono", Consolas, ui-monospace, monospace', label: "Cascadia Code" },
  { id: 'Calibri, "Segoe UI", sans-serif', label: "Calibri" },
  { id: 'Georgia, "Times New Roman", serif', label: "Georgia" },
  { id: 'Bahnschrift, "Segoe UI", sans-serif', label: "Bahnschrift" },
];

export function fieldById(id: string): TokenField {
  return TOKEN_FIELDS.find((f) => f.id === id) ?? TOKEN_FIELDS[0];
}

export function firstFieldInGroup(group: string): TokenField {
  return TOKEN_FIELDS.find((f) => f.group === group) ?? TOKEN_FIELDS[0];
}

export function parsePx(value: string | undefined, fallback: number): number {
  const n = Number.parseFloat(value ?? "");
  return Number.isFinite(n) ? n : fallback;
}

function isColorValue(value: string): boolean {
  const v = value.trim();
  return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) || /^rgba?\(/i.test(v);
}

export function tryHex6(value: string): string | null {
  if (!isColorValue(value)) return null;
  return parseColor(value).rgb;
}

export function toHex6(value: string): string {
  return parseColor(value).rgb;
}

export function parseColor(value: string): { rgb: string; alpha: number } {
  const v = value.trim();
  const byteToPct = (n: number) => Math.round((Math.max(0, Math.min(255, n)) / 255) * 100);
  if (/^#[0-9a-f]{8}$/i.test(v)) {
    return { rgb: `#${v.slice(1, 7)}`.toLowerCase(), alpha: byteToPct(Number.parseInt(v.slice(7, 9), 16)) };
  }
  if (/^#[0-9a-f]{4}$/i.test(v)) {
    const a = v[4];
    return {
      rgb: `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase(),
      alpha: byteToPct(Number.parseInt(`${a}${a}`, 16)),
    };
  }
  const rgba = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+%?))?\s*\)/i);
  if (rgba) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, "0");
    const rgb = `#${hex(rgba[1])}${hex(rgba[2])}${hex(rgba[3])}`;
    if (rgba[4] === undefined) return { rgb, alpha: 100 };
    const raw = rgba[4];
    if (raw.endsWith("%")) return { rgb, alpha: Math.round(Number.parseFloat(raw)) };
    const n = Number.parseFloat(raw);
    return { rgb, alpha: n > 1 ? byteToPct(n) : Math.round(n * 100) };
  }
  if (/^#[0-9a-f]{6}$/i.test(v)) return { rgb: v.toLowerCase(), alpha: 100 };
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return { rgb: `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase(), alpha: 100 };
  }
  return { rgb: "#808080", alpha: 100 };
}

export function composeColor(rgb: string, alpha: number): string {
  const hex = toHex6(rgb);
  const clamped = Math.max(0, Math.min(100, Math.round(alpha)));
  if (clamped >= 100) return hex;
  const byte = Math.round((clamped / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${byte}`;
}

export function tryHexColor(value: string): string | null {
  if (!isColorValue(value)) return null;
  const parsed = parseColor(value);
  return composeColor(parsed.rgb, parsed.alpha);
}

export type FillMode = "solid" | "linear" | "radial";

export interface ParsedFill {
  mode: FillMode;
  from: string;
  to: string;
  angle: number;
}

const HEX_STOP = "#(?:[0-9a-f]{3,8})";

function hexStop(value: string, fallback: string): string {
  return tryHexColor(value) ?? tryHexColor(fallback) ?? toHex6(fallback);
}

export function parseFill(fill: string | undefined, solid: string): ParsedFill {
  const from = hexStop(solid, solid);
  const raw = (fill ?? "").trim();
  if (!raw || raw === "none") {
    return { mode: "solid", from, to: from, angle: 160 };
  }
  const lin = raw.match(new RegExp(`^linear-gradient\\(\\s*(-?\\d+(?:\\.\\d+)?)deg\\s*,\\s*(${HEX_STOP})(?:\\s+\\d+%)?\\s*,\\s*(${HEX_STOP})`, "i"));
  if (lin) {
    return { mode: "linear", from: hexStop(lin[2], solid), to: hexStop(lin[3], solid), angle: Number(lin[1]) || 160 };
  }
  const rad = raw.match(new RegExp(`^radial-gradient\\([^,]*,\\s*(${HEX_STOP})(?:\\s+\\d+%)?\\s*,\\s*(${HEX_STOP})`, "i"));
  if (rad) {
    return { mode: "radial", from: hexStop(rad[1], solid), to: hexStop(rad[2], solid), angle: 160 };
  }
  return { mode: "solid", from, to: from, angle: 160 };
}

export function composeFill(fill: ParsedFill): string {
  if (fill.mode === "solid") return "none";
  if (fill.mode === "linear") {
    return `linear-gradient(${Math.round(fill.angle)}deg, ${fill.from} 0%, ${fill.to} 100%)`;
  }
  return `radial-gradient(120% 80% at 100% 0%, ${fill.from} 0%, ${fill.to} 70%)`;
}

export function shiftHex(hex: string, amount: number): string {
  const h = toHex6(hex).slice(1);
  const n = Number.parseInt(h, 16);
  const ch = (v: number) => Math.max(0, Math.min(255, v + amount)).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) + amount)}${ch(((n >> 8) & 255) + amount)}${ch((n & 255) + amount)}`;
}

function foldFont(value: string): string {
  return value.replace(/['"]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function matchStudioFont(value: string): string {
  const folded = foldFont(value);
  const exact = STUDIO_FONTS.find((font) => foldFont(font.id) === folded);
  if (exact) return exact.id;
  const head = folded.split(",")[0]?.trim();
  return STUDIO_FONTS.find((font) => foldFont(font.id).startsWith(head))?.id ?? STUDIO_FONTS[0].id;
}

export function normalizeStudioTokens(tokens: Record<string, string>): Record<string, string> {
  const out = expandThemeTokens(tokens);
  for (const field of TOKEN_FIELDS) {
    const v = out[field.id];
    if (!v) continue;
    if (field.kind === "color" || field.kind === "paint") {
      const hex = tryHexColor(v);
      if (hex) out[field.id] = hex;
    } else if (field.kind === "font") {
      out[field.id] = matchStudioFont(v);
    }
  }
  for (const key of FILL_KEYS) {
    if (!out[key]) out[key] = "none";
  }
  return out;
}

export function tokensForSave(tokens: Record<string, string>): Record<string, string> {
  const fallback = expandThemeTokens(defaultThemeTokens());
  const full = expandThemeTokens(tokens);
  const out: Record<string, string> = {};
  for (const field of TOKEN_FIELDS) {
    const v = full[field.id] ?? fallback[field.id];
    if (!v) continue;
    if (field.kind === "color" || field.kind === "paint") {
      out[field.id] = tryHexColor(v) ?? fallback[field.id] ?? v;
    } else {
      out[field.id] = v;
    }
    if (field.fillKey) {
      const fill = (full[field.fillKey] ?? fallback[field.fillKey] ?? "none").trim() || "none";
      out[field.fillKey] = fill;
    }
  }
  return out;
}
