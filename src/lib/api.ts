import { invoke } from "@tauri-apps/api/core";
import type {
  AppPaths,
  CatalogProgram,
  InstallRequest,
  InstalledProgram,
  ProcessStatus,
  ProgramRelease,
  StoreSettings,
  ThemePack,
  TrustRecord,
  UpdateInfo,
  VerifyReport,
} from "./types";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    return mock(cmd, args) as T;
  }
  return invoke<T>(cmd, args);
}

export const api = {
  settings: () => call<StoreSettings>("get_store_settings"),
  saveSettings: (settings: StoreSettings) => call<void>("save_store_settings", { settings }),
  paths: () => call<AppPaths>("get_app_paths"),
  official: () => call<CatalogProgram[]>("official_catalog"),
  community: () => call<CatalogProgram[]>("community_catalog"),
  searchGithub: (query: string) => call<CatalogProgram[]>("search_github", { query }),
  fetchGithub: (github: string) => call<CatalogProgram>("fetch_github_program", { github }),
  getProgram: (id: string) => call<CatalogProgram>("get_program", { id }),
  verify: (request: InstallRequest) => call<VerifyReport>("verify_program", { request }),
  trustLedger: () => call<TrustRecord[]>("list_trust"),
  revokeTrust: (id: string) => call<void>("revoke_trust", { id }),
  install: (request: InstallRequest) => call<InstalledProgram>("install_program", { request }),
  uninstall: (id: string, wipeConfig: boolean) =>
    call<void>("uninstall_program", { id, wipeConfig }),
  rollback: (id: string) => call<void>("rollback_program", { id }),
  installed: () => call<InstalledProgram[]>("list_installed"),
  start: (id: string) => call<number>("start_program", { id }),
  stop: (id: string) => call<void>("stop_program", { id }),
  restart: (id: string) => call<number>("restart_program", { id }),
  status: (id: string) => call<ProcessStatus>("program_status", { id }),
  logs: (id: string) => call<string>("program_logs", { id }),
  programSettings: (id: string) => call<Record<string, unknown>>("get_program_settings", { id }),
  saveProgramSettings: (id: string, value: Record<string, unknown>) =>
    call<void>("save_program_settings", { id, value }),
  updates: () => call<UpdateInfo[]>("check_updates"),
  applyUpdate: (id: string, version?: string) =>
    call<InstalledProgram>("apply_program_update", { id, version }),
  programReleases: (id: string) => call<ProgramRelease[]>("list_program_releases", { id }),
  saveProgramInstallOptions: (options: {
    id: string;
    pinnedVersion?: string | null;
    launchArgs: string;
    rememberElevation?: boolean;
    updateChannel: string;
    autostart: boolean;
    enabled: boolean;
  }) => call<InstalledProgram>("save_program_install_options", { options }),
  themes: () => call<ThemePack[]>("list_themes"),
  importTheme: (path: string) => call<ThemePack>("import_theme", { path }),
  saveTheme: (pack: ThemePack) => call<ThemePack>("save_theme", { pack }),
  deleteTheme: (id: string) => call<void>("delete_theme", { id }),
  sideload: (path: string) => call<InstalledProgram>("sideload_program", { path }),
  openPath: (path: string) => call<void>("open_path", { path }),
  clearCache: () => call<void>("clear_cache"),
  defenderExclusion: () => call<void>("set_defender_exclusion"),
  setAutostart: (id: string, enabled: boolean) =>
    call<void>("set_autostart_program", { id, enabled }),
  setEnabled: (id: string, enabled: boolean) =>
    call<void>("set_program_enabled", { id, enabled }),
  searchThemes: (query: string) => call<CatalogProgram[]>("search_theme_github", { query }),
  launchUpdater: () => call<void>("launch_store_updater"),
};

const mockRunning = new Set<string>();
let mockInstalled: InstalledProgram[] | null = null;
let mockCustomThemes: ThemePack[] = [];
let mockSettings: StoreSettings | null = null;

function defaultMockSettings(): StoreSettings {
  return {
    language: "system",
    themeId: "system",
    density: "comfortable",
    sidebarPosition: "left",
    mica: false,
    animations: true,
    reducedMotion: false,
    fontScale: 1,
    startWithWindows: false,
    startMinimized: false,
    trayEnabled: true,
    warnThirdParty: true,
    hashFailPolicy: "reject",
    autoUpdateStore: true,
    autoUpdatePrograms: "notify",
    storeUpdatePolicy: "startup",
    programUpdatePolicy: "startup",
    lastCatalogIds: [],
    developerMode: true,
    verboseLogs: false,
    defenderExclusionConsent: false,
    isolationJobObject: false,
    telemetry: false,
    updateChannel: "stable",
    customCss: false,
    prefsRevision: 1,
  };
}

function ensureMockInstalled(): InstalledProgram[] {
  if (!mockInstalled) {
    mockInstalled = [];
  }
  return mockInstalled;
}

function mock(cmd: string, args?: Record<string, unknown>): unknown {
  switch (cmd) {
    case "get_store_settings":
      return mockSettings ?? (mockSettings = defaultMockSettings());
    case "save_store_settings":
      mockSettings = args?.settings as StoreSettings;
      return null;
    case "official_catalog":
      return [];
    case "community_catalog":
      return [];
    case "list_installed":
      return ensureMockInstalled();
    case "start_program":
      mockRunning.add(String(args?.id ?? ""));
      return 4242;
    case "stop_program":
      mockRunning.delete(String(args?.id ?? ""));
      return null;
    case "uninstall_program":
      mockInstalled = ensureMockInstalled().filter((p) => p.id !== args?.id);
      return null;
    case "apply_program_update": {
      const list = ensureMockInstalled();
      const i = list.findIndex((p) => p.id === args?.id);
      if (i < 0) return null;
      const nextVer = String(args?.version ?? "1.2.0");
      list[i] = {
        ...list[i],
        version: nextVer,
        updatedAt: new Date().toISOString(),
        manifest: { ...list[i].manifest, version: nextVer },
      };
      return list[i];
    }
    case "get_app_paths":
      return {
        programs: "%LOCALAPPDATA%\\MuckStore\\programs",
        config: "%APPDATA%\\MuckStore\\config",
        cache: "%LOCALAPPDATA%\\MuckStore\\cache",
        logs: "%LOCALAPPDATA%\\MuckStore\\logs",
        themes: "%APPDATA%\\MuckStore\\themes",
        runtimes: "%LOCALAPPDATA%\\MuckStore\\runtimes",
        dataRoot: "%LOCALAPPDATA%\\MuckStore",
      };
    case "list_themes":
      return mockCustomThemes;
    case "save_theme": {
      const pack = args?.pack as ThemePack;
      mockCustomThemes = [...mockCustomThemes.filter((t) => t.id !== pack.id), pack];
      return pack;
    }
    case "delete_theme":
      mockCustomThemes = mockCustomThemes.filter((t) => t.id !== args?.id);
      return null;
    case "check_updates":
      return [
        {
          id: "com.muckstore.app",
          current: "1.0.0",
          available: "1.0.1",
          store: true,
          kind: "store",
          name: "Muck Store",
          pinned: false,
        },
      ] satisfies UpdateInfo[];
    case "list_program_releases":
      return [
        { tag: "1.2.0", prerelease: false, body: "Latest" },
        { tag: "1.1.0", prerelease: false, body: null },
        { tag: "1.0.0", prerelease: false, body: null },
      ];
    case "save_program_install_options": {
      const options = args?.options as {
        id: string;
        pinnedVersion?: string | null;
        launchArgs: string;
        rememberElevation?: boolean;
        updateChannel: string;
        autostart: boolean;
        enabled: boolean;
      };
      const list = ensureMockInstalled();
      const i = list.findIndex((p) => p.id === options.id);
      if (i < 0) return null;
      list[i] = {
        ...list[i],
        pinnedVersion: options.pinnedVersion,
        launchArgs: options.launchArgs,
        rememberElevation: options.rememberElevation,
        updateChannel: options.updateChannel,
        autostart: options.autostart,
        enabled: options.enabled,
      };
      return list[i];
    }
    case "get_program":
      return null;
    case "search_github":
    case "search_theme_github":
      return [];
    case "program_logs":
      return "";
    case "get_program_settings":
      return { fontSize: 14, theme: "dark", autosave: true };
    case "program_status":
      return { id: args?.id, running: mockRunning.has(String(args?.id ?? "")) };
    case "list_trust":
      return [];
    case "verify_program": {
      const req = (args?.request ?? {}) as { official?: boolean; id?: string };
      const officialId = Boolean(req.official);
      return {
        programId: req.id ?? "unknown",
        name: String(req.id ?? "Program"),
        official: officialId,
        verdict: officialId ? "verified" : "needsApproval",
        github: "",
        version: "1.0.0",
        commitSha: officialId ? null : "deadbeef",
        checks: officialId
          ? [
              { id: "manifest", status: "pass", detail: "muck.json valid" },
              { id: "official", status: "pass", detail: "listed in the official catalog" },
              { id: "license", status: "pass", detail: "license MIT" },
              { id: "hash", status: "pass", detail: "bundled payload" },
              { id: "public", status: "pass", detail: "official payload is bundled with Muck Store" },
              { id: "attestation", status: "pass", detail: "official tree is copied from this checkout" },
            ]
          : [
              { id: "manifest", status: "pass", detail: "muck.json valid" },
              { id: "official", status: "warn", detail: "community program" },
              { id: "license", status: "pass", detail: "license MIT" },
              { id: "public", status: "warn", detail: "github source" },
              { id: "permissions", status: "pass", detail: "declared permissions" },
              { id: "workflow", status: "pass", detail: "not a Release binary — no Actions attestation required" },
            ],
      };
    }
    default:
      return null;
  }
}
