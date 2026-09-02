import { create } from "zustand";
import { api } from "../lib/api";
import { applyChrome, applyTheme, readAppliedTokens } from "../lib/themes";
import { normalizeStudioTokens } from "../lib/themeStudio";
import { setupI18n } from "../i18n";
import { watchSystemAppearance } from "../lib/systemAppearance";
import type {
  AppPaths,
  CatalogProgram,
  InstalledProgram,
  StoreSettings,
  ThemePack,
  UpdateInfo,
} from "../lib/types";

export type OverlayId = "themes" | "settings";

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
  themes: ThemePack[];
  paths: AppPaths | null;
  overlay: OverlayId | null;
  studio: StudioSession | null;
  notice: string | null;
  setOverlay: (overlay: OverlayId | null) => void;
  openStudio: (pack?: ThemePack) => void;
  closeStudio: () => void;
  showNotice: (message: string) => void;
  hydrate: () => Promise<void>;
  refreshInstalled: () => Promise<void>;
  remember: (program: CatalogProgram) => void;
  patchSettings: (partial: Partial<StoreSettings>) => Promise<void>;
}

async function applyVisuals(s: StoreSettings, custom?: Record<string, string>) {
  applyTheme(s.themeId, custom, s.accent);
  applyChrome(s.density, s.fontScale, s.reducedMotion, s.mica, s.animations);
  document.documentElement.setAttribute("data-sidebar", s.sidebarPosition);
  await setupI18n(s.language);
}

let stopSystemWatch: (() => void) | null = null;
let noticeTimer: number | undefined;

function followSystemIfNeeded(getSettings: () => StoreSettings | null, getCustom: (id: string) => Record<string, string> | undefined) {
  stopSystemWatch?.();
  stopSystemWatch = watchSystemAppearance(() => {
    const s = getSettings();
    if (!s) return;
    if (s.language !== "system" && s.themeId !== "system") return;
    void applyVisuals(s, getCustom(s.themeId));
  });
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
  themes: [],
  paths: null,
  overlay: null,
  studio: null,
  notice: null,
  setOverlay: (overlay) => set({ overlay, studio: overlay ? null : get().studio }),
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
      void api
        .searchGithub("")
        .then((found) => {
          set((s) => {
            const map = new Map(s.discovered.map((p) => [p.id, p]));
            for (const program of found) {
              const prev = map.get(program.id);
              map.set(
                program.id,
                prev
                  ? {
                      ...program,
                      ...prev,
                      stars: prev.stars ?? program.stars,
                      forks: prev.forks ?? program.forks,
                      language: prev.language ?? program.language,
                      updatedAt: prev.updatedAt ?? program.updatedAt,
                    }
                  : program,
              );
            }
            return { discovered: [...map.values()] };
          });
        })
        .catch(() => undefined);
      void api
        .updates()
        .then(async (updates) => {
          set({ updates });
          if (settings.autoUpdatePrograms === "auto") {
            for (const u of updates) {
              if (u.available && !u.store) {
                await api.applyUpdate(u.id).catch(() => undefined);
              }
            }
            await get().refreshInstalled();
            const next = await api.updates().catch(() => updates);
            set({ updates: next });
          }
        })
        .catch(() => undefined);
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
    const custom = get().themes.find((t) => t.id === next.themeId)?.tokens;
    await applyVisuals(next, custom);
    set({ settings: next });
    followSystemIfNeeded(
      () => get().settings,
      (id) => get().themes.find((t) => t.id === id)?.tokens,
    );
  },
}));
