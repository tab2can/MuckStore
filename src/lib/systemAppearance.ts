import { isSupportedLocale, matchSupportedLocale, type LocaleId } from "../i18n/catalog";
import { isTauri } from "./api";

export function systemLanguage(): LocaleId {
  const tags =
    typeof navigator === "undefined"
      ? ["en"]
      : [navigator.language, ...(navigator.languages ?? [])].filter(Boolean);
  for (const tag of tags) {
    const hit = matchSupportedLocale(tag);
    if (hit) return hit;
  }
  return "en";
}

export function systemThemeId(): string {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "midnight";
  }
  if (window.matchMedia("(prefers-contrast: more)").matches) {
    return "high-contrast";
  }
  if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "daylight";
  }
  return "midnight";
}

/** Windows accent (CSS AccentColor). Only used in the Tauri WebView, not the browser mock. */
export function systemAccent(): { accent: string; accentText: string } | null {
  if (!isTauri || typeof document === "undefined") return null;
  const probe = document.createElement("span");
  probe.style.color = "AccentColor";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.documentElement.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  if (r + g + b === 0) return null;
  if (r > 250 && g > 250 && b > 250) return null;
  const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return { accent: hex, accentText: luminance > 0.55 ? "#1a1408" : "#fff8ef" };
}

export function resolveLanguage(pref: string): LocaleId {
  if (isSupportedLocale(pref)) return pref;
  return systemLanguage();
}

export function resolveThemeId(pref: string): string {
  if (pref && pref !== "system") return pref;
  return systemThemeId();
}

export function watchSystemAppearance(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  window.addEventListener("languagechange", onChange);
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  const contrast = window.matchMedia("(prefers-contrast: more)");
  scheme.addEventListener("change", onChange);
  contrast.addEventListener("change", onChange);

  let unlistenTauri: (() => void) | undefined;
  if (isTauri) {
    void import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => getCurrentWindow().onThemeChanged(() => onChange()))
      .then((fn) => {
        unlistenTauri = fn;
      })
      .catch(() => undefined);
  }

  return () => {
    window.removeEventListener("languagechange", onChange);
    scheme.removeEventListener("change", onChange);
    contrast.removeEventListener("change", onChange);
    unlistenTauri?.();
  };
}
