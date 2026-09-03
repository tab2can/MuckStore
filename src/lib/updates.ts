import type { CatalogProgram, UpdateInfo } from "./types";

export type UpdateReason = "startup" | "interval" | "manual";

export const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function isRateLimited(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /rate-limited|429/i.test(msg);
}

export function updateKind(item: UpdateInfo) {
  if (item.kind) return item.kind;
  return item.store ? "store" : "program";
}

export function hasActionableUpdate(item: UpdateInfo) {
  return Boolean(item.available) && !item.pinned && updateKind(item) !== "catalog";
}

export function catalogNews(
  programs: CatalogProgram[],
  seenIds: string[],
): UpdateInfo[] {
  const seen = new Set(seenIds);
  return programs
    .filter((p) => !seen.has(p.id))
    .map((p) => ({
      id: p.id,
      current: "",
      available: p.version,
      changelog: p.summary,
      store: false,
      kind: "catalog",
      name: p.name,
      pinned: false,
    }));
}
