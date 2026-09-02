import { convertFileSrc } from "@tauri-apps/api/core";
import type { CatalogProgram } from "./types";

export type SortKey = "stars" | "forks" | "name" | "updated";
export type OriginFilter = "all" | "official" | "community";

const EXT_LANGUAGE: Record<string, string> = {
  ps1: "PowerShell",
  psm1: "PowerShell",
  psd1: "PowerShell",
  py: "Python",
  pyw: "Python",
  js: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  jsx: "JavaScript",
  ts: "TypeScript",
  tsx: "TypeScript",
  rs: "Rust",
  go: "Go",
  cs: "C#",
  cpp: "C++",
  cc: "C++",
  cxx: "C++",
  c: "C",
  java: "Java",
  kt: "Kotlin",
  swift: "Swift",
  rb: "Ruby",
  php: "PHP",
  lua: "Lua",
  sh: "Shell",
  bash: "Shell",
  bat: "Batch",
  cmd: "Batch",
};

export function programLanguage(program: CatalogProgram): string | undefined {
  if (program.language) return program.language;
  const entry = program.manifest?.entry;
  if (!entry) return undefined;
  const ext = entry.split(".").pop()?.toLowerCase();
  return ext ? EXT_LANGUAGE[ext] : undefined;
}

export function displayName(program: CatalogProgram, locale: string): string {
  return program.manifest?.i18n?.[locale]?.name ?? program.name;
}

export function displaySummary(program: CatalogProgram, locale: string): string {
  return program.manifest?.i18n?.[locale]?.summary ?? program.summary;
}

function mergeProgram(base: CatalogProgram, next: CatalogProgram): CatalogProgram {
  return {
    ...base,
    ...next,
    stars: next.stars ?? base.stars,
    forks: next.forks ?? base.forks,
    language: next.language ?? base.language,
    updatedAt: next.updatedAt ?? base.updatedAt,
    ownerAvatar: next.ownerAvatar ?? base.ownerAvatar,
  };
}

export function mergeCatalog(
  official: CatalogProgram[],
  community: CatalogProgram[],
  discovered: CatalogProgram[],
): CatalogProgram[] {
  const map = new Map<string, CatalogProgram>();
  for (const program of [...discovered, ...community, ...official]) {
    const prev = map.get(program.id);
    map.set(program.id, prev ? mergeProgram(prev, program) : program);
  }
  return [...map.values()];
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function haystack(program: CatalogProgram, locale: string): string {
  const loc = program.manifest?.i18n?.[locale];
  return [
    program.name,
    program.summary,
    program.description,
    program.id,
    program.sourceGithub,
    program.license,
    programLanguage(program),
    loc?.name,
    loc?.summary,
    ...(program.tags ?? []),
    ...(program.categories ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesQuery(program: CatalogProgram, query: string, locale: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack(program, locale).includes(q);
}

function cmpNum(a?: number | null, b?: number | null) {
  return (b ?? -1) - (a ?? -1);
}

export function sortPrograms(list: CatalogProgram[], key: SortKey, locale: string): CatalogProgram[] {
  return [...list].sort((a, b) => {
    let n = 0;
    if (key === "stars") n = cmpNum(a.stars, b.stars);
    else if (key === "forks") n = cmpNum(a.forks, b.forks);
    else if (key === "updated") n = (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    else n = displayName(a, locale).localeCompare(displayName(b, locale), undefined, { sensitivity: "base" });
    if (n !== 0) return n;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return displayName(a, locale).localeCompare(displayName(b, locale), undefined, { sensitivity: "base" });
  });
}

export function popularPrograms(list: CatalogProgram[], locale: string, limit = 6): CatalogProgram[] {
  return sortPrograms(list, "stars", locale).slice(0, limit);
}

export function uniqueLanguages(list: CatalogProgram[]): string[] {
  return [...new Set(list.map(programLanguage).filter((v): v is string => Boolean(v)))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function uniqueCategories(list: CatalogProgram[]): string[] {
  return [...new Set(list.flatMap((p) => p.categories ?? []))].sort((a, b) => a.localeCompare(b));
}

export function uniqueLicenses(list: CatalogProgram[]): string[] {
  return [...new Set(list.map((p) => p.license).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function filterPrograms(
  list: CatalogProgram[],
  opts: {
    language?: string;
    category?: string;
    license?: string;
    origin?: OriginFilter;
    locale: string;
    query?: string;
  },
): CatalogProgram[] {
  return list.filter((program) => {
    if (opts.origin === "official" && !program.official) return false;
    if (opts.origin === "community" && program.official) return false;
    if (opts.language && programLanguage(program) !== opts.language) return false;
    if (opts.category && !(program.categories ?? []).includes(opts.category)) return false;
    if (opts.license && program.license !== opts.license) return false;
    if (opts.query && !matchesQuery(program, opts.query, opts.locale)) return false;
    return true;
  });
}

export function topPrograms(
  list: CatalogProgram[],
  key: "stars" | "forks",
  locale: string,
  limit = 10,
): CatalogProgram[] {
  return sortPrograms(list, key, locale).slice(0, Math.min(limit, list.length));
}

export function hasLocale(program: CatalogProgram, locale: string): boolean {
  const lang = locale.split("-")[0];
  if (lang === "en") return true;
  return Boolean(program.manifest?.i18n?.[lang]);
}

export function githubUrl(program: CatalogProgram): string {
  if (program.htmlUrl) return program.htmlUrl;
  const repo = program.sourceGithub.replace(/^https:\/\/github.com\//i, "").replace(/\/$/, "");
  return `https://github.com/${repo}`;
}

export function resolveAssetUrl(program: CatalogProgram, src: string): string {
  const trimmed = src.trim().replace(/^<|>$/g, "");
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;
  const repo = program.sourceGithub.replace(/^https:\/\/github.com\//i, "").replace(/\/$/, "");
  const path = trimmed.replace(/^\.?\//, "");
  return `https://raw.githubusercontent.com/${repo}/HEAD/${path}`;
}

export function programGallery(program: CatalogProgram): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw?: string | null) => {
    if (!raw) return;
    const url = resolveAssetUrl(program, raw);
    if (seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };
  for (const shot of program.screenshots ?? []) add(shot);
  for (const shot of program.manifest?.ui?.screenshots ?? []) add(shot);
  if (program.readme) {
    const re = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(program.readme))) add(match[1]);
  }
  return out;
}

export function formatUpdated(iso: string | null | undefined, locale: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

export function programUpdatedAt(program: { installedAt: string; updatedAt?: string | null }): string {
  return program.updatedAt || program.installedAt;
}

export function wasUpdatedAfterInstall(program: { installedAt: string; updatedAt?: string | null }): boolean {
  const updated = programUpdatedAt(program);
  return Boolean(updated && program.installedAt && updated > program.installedAt);
}

export function installedIconUrl(program: {
  installPath: string;
  manifest: { ui?: { icon?: string | null } | null };
}): string | undefined {
  const raw = program.manifest.ui?.icon?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return raw;
  const sep = program.installPath.includes("\\") ? "\\" : "/";
  const path = `${program.installPath.replace(/[\\/]+$/, "")}${sep}${raw.replace(/^\.?\//, "")}`;
  try {
    return convertFileSrc(path);
  } catch {
    return undefined;
  }
}
