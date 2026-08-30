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
    },
  },
];

export function applyTheme(
  themeId: string,
  extra?: Record<string, string>,
  accent?: string | null,
) {
  const builtin = BUILTIN_THEMES.find((t) => t.id === themeId);
  const tokens = { ...(builtin?.tokens ?? BUILTIN_THEMES[0].tokens), ...(extra ?? {}) };
  if (accent) tokens.accent = accent;
  const root = document.documentElement;
  const map: Record<string, string> = {
    bg: "--bg",
    bgElevated: "--bg-elevated",
    surface: "--surface",
    surfaceHover: "--surface-hover",
    border: "--border",
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
  };
  for (const [key, css] of Object.entries(map)) {
    if (tokens[key]) root.style.setProperty(css, tokens[key]);
  }
  root.setAttribute("data-theme", themeId);
}

export function applyChrome(density: string, fontScale: number, reducedMotion: boolean, mica: boolean) {
  const root = document.documentElement;
  root.setAttribute("data-density", density);
  root.style.fontSize = `${16 * fontScale}px`;
  root.setAttribute("data-motion", reducedMotion ? "reduce" : "full");
  root.setAttribute("data-mica", mica ? "on" : "off");
}
