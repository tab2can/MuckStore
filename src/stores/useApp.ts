import { create } from "zustand";
import { api } from "../lib/api";
import { applyChrome, applyTheme, readAppliedTokens } from "../lib/themes";
import { normalizeStudioTokens } from "../lib/themeStudio";
import { setupI18n } from "../i18n";
import { watchSystemAppearance } from "../lib/systemAppearance";
import { mergeCatalog } from "../lib/catalogBrowse";
import {
  catalogNews,
  hasActionableUpdate,
  isRateLimited,
  UPDATE_INTERVAL_MS,
  updateKind,
  type UpdateReason,
} from "../lib/updates";
import type {
  AppPaths,
  CatalogProgram,
  InstalledProgram,
  StoreSettings,
  ThemePack,
  UpdateInfo,
} from "../lib/types";

export type OverlayId = "themes" | "settings" | "program";
export type SettingsSection =
  | "appearance"
  | "startup"
  | "library"
  | "updates"
  | "privacy"
  | "security"
  | "approvals"
  | "developer";

export type StudioSession =
  | { mode: "new"; tokens: Record<string, string> }
  | { mode: "edit"; pack: ThemePack; tokens: Record<string, string> };

interface AppState {
  ready: boolean;
  error: string | null;
  settings: StoreSettings | null;
  official: CatalogProgram[];
  community: CatalogProgram[];
  discovered: CatalogProgram[];
  installed: InstalledProgram[];
  updates: UpdateInfo[];
  updatesPending: boolean;
  checkingUpdates: boolean;
  themes: ThemePack[];
  paths: AppPaths | null;
  overlay: OverlayId | null;
  settingsSection: SettingsSection;
  programSettingsId: string | null;
  studio: StudioSession | null;
  notice: string | null;
  setOverlay: (overlay: OverlayId | null) => void;
  openUpdates: () => void;
  openProgramSettings: (id: string) => void;
  openStudio: (pack?: ThemePack) => void;
  closeStudio: () => void;
  showNotice: (message: string) => void;
  hydrate: () => Promise<void>;
  refreshInstalled: () => Promise<void>;
  remember: (program: CatalogProgram) => void;
  patchSettings: (partial: Partial<StoreSettings>) => Promise<void>;
  checkUpdates: (reason: UpdateReason) => Promise<UpdateInfo[]>;
  applyAllUpdates: () => Promise<void>;
  deferUpdates: () => void;
}

async function applyVisuals(s: StoreSettings, custom?: Record<string, string>) {
  applyTheme(s.themeId, custom, s.accent);
  applyChrome(s.density, s.fontScale, s.reducedMotion, s.mica, s.animations);
  document.documentElement.setAttribute("data-sidebar", s.sidebarPosition);
  await setupI18n(s.language);
}

let stopSystemWatch: (() => void) | null = null;
let noticeTimer: number | undefined;
let updateTimer: number | undefined;

function followSystemIfNeeded(getSettings: () => StoreSettings | null, getCustom: (id: string) => Record<string, string> | undefined) {
  stopSystemWatch?.();
  stopSystemWatch = watchSystemAppearance(() => {
    const s = getSettings();
    if (!s) return;
    if (s.language !== "system" && s.themeId !== "system") return;
    void applyVisuals(s, getCustom(s.themeId));
  });
}

function policy(settings: StoreSettings | null, which: "store" | "program") {
  if (which === "store") {
    if (settings?.storeUpdatePolicy) return settings.storeUpdatePolicy;
    return settings?.autoUpdateStore === false ? "manual" : "startup";
  }
  if (settings?.programUpdatePolicy) return settings.programUpdatePolicy;
  if (settings?.autoUpdatePrograms === "auto") return "auto";
  if (settings?.autoUpdatePrograms === "off") return "manual";
  return "startup";
}

function backoffActive(settings: StoreSettings | null) {
  const until = settings?.updateCheckBackoffUntil;
  if (!until) return false;
  const t = Date.parse(until);
  return Number.isFinite(t) && t > Date.now();
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  error: null,
  settings: null,
  official: [],
  community: [],
  discovered: [],
  installed: [],
  updates: [],
  updatesPending: false,
  checkingUpdates: false,
  themes: [],
  paths: null,
  overlay: null,
  settingsSection: "appearance",
  programSettingsId: null,
  studio: null,
  notice: null,
  setOverlay: (overlay) =>
    set({
      overlay,
      studio: overlay ? null : get().studio,
      programSettingsId: overlay === "program" ? get().programSettingsId : null,
    }),
  openUpdates: () => set({ overlay: "settings", settingsSection: "updates", studio: null }),
  openProgramSettings: (id) => set({ overlay: "program", programSettingsId: id, studio: null }),
  openStudio: (pack) => {
    const tokens = normalizeStudioTokens(pack?.tokens ?? readAppliedTokens());
    set(
      pack
        ? { overlay: null, studio: { mode: "edit", pack, tokens } }
        : { overlay: null, studio: { mode: "new", tokens } },
    );
  },
  closeStudio: () => set({ studio: null }),
  showNotice: (message) => {
    if (noticeTimer) window.clearTimeout(noticeTimer);
    set({ notice: message });
    noticeTimer = window.setTimeout(() => {
      set({ notice: null });
      noticeTimer = undefined;
    }, 1600);
  },
  hydrate: async () => {
    try {
      const settings = await api.settings();
      const [official, community, installed, themes, paths] = await Promise.all([
        api.official(),
        api.community(),
        api.installed(),
        api.themes(),
        api.paths(),
      ]);
      await applyVisuals(
        settings,
        themes.find((t) => t.id === settings.themeId)?.tokens,
      );
      set({ settings, official, community, installed, themes, paths, ready: true, error: null });
      followSystemIfNeeded(
        () => get().settings,
        (id) => get().themes.find((t) => t.id === id)?.tokens,
      );
      void get().checkUpdates("startup");
      if (updateTimer) window.clearInterval(updateTimer);
      updateTimer = window.setInterval(() => {
        void get().checkUpdates("interval");
      }, UPDATE_INTERVAL_MS);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), ready: true });
    }
  },
  refreshInstalled: async () => {
    const installed = await api.installed();
    const official = await api.official();
    const community = await api.community();
    set({ installed, official, community });
  },
  remember: (program) => {
    set((s) => ({
      discovered: [program, ...s.discovered.filter((p) => p.id !== program.id)],
    }));
  },
  patchSettings: async (partial) => {
    const current = get().settings;
    if (!current) return;
    const next = { ...current, ...partial };
    await api.saveSettings(next);
    const saved = (await api.settings().catch(() => next)) ?? next;
    const custom = get().themes.find((t) => t.id === saved.themeId)?.tokens;
    await applyVisuals(saved, custom);
    set({ settings: saved });
    followSystemIfNeeded(
      () => get().settings,
      (id) => get().themes.find((t) => t.id === id)?.tokens,
    );
  },
  checkUpdates: async (reason) => {
    const current = get().settings;
    if (get().checkingUpdates) return get().updates;
    if (reason !== "manual" && backoffActive(current)) return get().updates;
    if (reason === "interval") {
      const last = Date.parse(current?.lastUpdateCheckAt ?? "");
      if (Number.isFinite(last) && Date.now() - last < UPDATE_INTERVAL_MS) {
        return get().updates;
      }
    }
    set({ checkingUpdates: true });
    try {
      const [list, official, community, found] = await Promise.all([
        api.updates(),
        api.official(),
        api.community(),
        api.searchGithub("").catch(() => [] as CatalogProgram[]),
      ]);
      set((s) => {
        const map = new Map(s.discovered.map((p) => [p.id, p]));
        for (const program of found) {
          const prev = map.get(program.id);
          map.set(
            program.id,
            prev
              ? {
                  ...prev,
                  ...program,
                  stars: program.stars ?? prev.stars,
                  forks: program.forks ?? prev.forks,
                  language: program.language ?? prev.language,
                  updatedAt: program.updatedAt ?? prev.updatedAt,
                }
              : program,
          );
        }
        return { official, community, discovered: [...map.values()] };
      });
      const catalog = mergeCatalog(official, community, get().discovered);
      const seen = current?.lastCatalogIds ?? [];
      const news = seen.length === 0 ? [] : catalogNews(catalog, seen);
      const updates = [
        ...list.filter((u) => updateKind(u) !== "catalog"),
        ...news,
      ];
      const catalogIds = catalog.map((p) => p.id);
      await get().patchSettings({
        lastUpdateCheckAt: new Date().toISOString(),
        updateCheckBackoffUntil: null,
        lastCatalogIds: catalogIds,
      });
      const programPolicy = policy(get().settings, "program");
      const shouldApply =
        (reason === "startup" && (programPolicy === "auto" || programPolicy === "startup")) ||
        (reason === "interval" && programPolicy === "auto");
      if (shouldApply) {
        for (const item of updates) {
          if (hasActionableUpdate(item) && updateKind(item) === "program") {
            await api.applyUpdate(item.id).catch(() => undefined);
          }
        }
        await get().refreshInstalled();
        const next = await api.updates().catch(() => updates.filter((u) => updateKind(u) !== "program" || !u.available));
        const merged = [...next.filter((u) => updateKind(u) !== "catalog"), ...news];
        const leftover = merged.some((u) => hasActionableUpdate(u) || updateKind(u) === "catalog");
        set({
          updates: merged,
          updatesPending: leftover,
          checkingUpdates: false,
        });
        return merged;
      }
      const leftover = updates.some((u) => hasActionableUpdate(u) || updateKind(u) === "catalog");
      set({
        updates,
        updatesPending: leftover && reason !== "manual",
        checkingUpdates: false,
      });
      return updates;
    } catch (e) {
      if (isRateLimited(e)) {
        const until = new Date(Date.now() + UPDATE_INTERVAL_MS).toISOString();
        await get().patchSettings({ updateCheckBackoffUntil: until }).catch(() => undefined);
      }
      set({ checkingUpdates: false });
      return get().updates;
    }
  },
  applyAllUpdates: async () => {
    const items = get().updates.filter(hasActionableUpdate);
    let launchStore = false;
    for (const item of items) {
      if (updateKind(item) === "store") {
        launchStore = true;
        continue;
      }
      if (updateKind(item) === "program") {
        await api.applyUpdate(item.id).catch(() => undefined);
      }
    }
    await get().refreshInstalled();
    const next = await get().checkUpdates("manual");
    set({
      updatesPending: next.some((u) => hasActionableUpdate(u) || updateKind(u) === "catalog"),
    });
    if (launchStore) await api.launchUpdater();
  },
  deferUpdates: () => {
    const leftover = get().updates.some(
      (u) => hasActionableUpdate(u) || updateKind(u) === "catalog",
    );
    set({ updatesPending: leftover });
  },
}));
