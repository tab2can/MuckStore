import { create } from "zustand";
import { api } from "../lib/api";
import { applyChrome, applyTheme } from "../lib/themes";
import { setupI18n } from "../i18n";
import type {
  AppPaths,
  CatalogProgram,
  InstalledProgram,
  StoreSettings,
  ThemePack,
  UpdateInfo,
} from "../lib/types";

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
  hydrate: () => Promise<void>;
  refreshInstalled: () => Promise<void>;
  remember: (program: CatalogProgram) => void;
  patchSettings: (partial: Partial<StoreSettings>) => Promise<void>;
}

function applyVisuals(s: StoreSettings, custom?: Record<string, string>) {
  applyTheme(s.themeId, custom, s.accent);
  applyChrome(s.density, s.fontScale, s.reducedMotion, s.mica);
  document.documentElement.setAttribute("data-sidebar", s.sidebarPosition);
  setupI18n(s.language);
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
  hydrate: async () => {
    try {
      const settings = await api.settings();
      applyVisuals(settings);
      const [official, community, installed, themes, paths] = await Promise.all([
        api.official(),
        api.community(),
        api.installed(),
        api.themes(),
        api.paths(),
      ]);
      set({ settings, official, community, installed, themes, paths, ready: true, error: null });
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
    applyVisuals(next, custom);
    set({ settings: next });
  },
}));
