import { invoke } from "@tauri-apps/api/core";
import type {
  AppPaths,
  CatalogProgram,
  InstallRequest,
  InstalledProgram,
  ProcessStatus,
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
  applyUpdate: (id: string) => call<InstalledProgram>("apply_program_update", { id }),
  themes: () => call<ThemePack[]>("list_themes"),
  importTheme: (path: string) => call<ThemePack>("import_theme", { path }),
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

function mock(cmd: string, args?: Record<string, unknown>): unknown {
  const official: CatalogProgram[] = [
    {
      id: "com.muckstore.quick-notes",
      name: "Quick Notes",
      version: "1.0.0",
      summary: "A portable notes pad that stores text next to the program.",
      license: "MIT",
      official: true,
      featured: true,
      sourceGithub: "muckstore/quick-notes",
      permissions: ["filesystem", "autostart"],
      categories: ["productivity"],
      tags: ["notes"],
      screenshots: [],
      installed: false,
      hasSettings: true,
      localResource: "programs/official/quick-notes",
      readme: "Official sample. No Muck SDK.",
    },
    {
      id: "com.muckstore.settings-gallery",
      name: "Settings Gallery",
      version: "1.0.0",
      summary: "Shows every Muck settings widget.",
      license: "MIT",
      official: true,
      featured: false,
      sourceGithub: "muckstore/settings-gallery",
      permissions: ["filesystem"],
      categories: ["developer"],
      tags: ["sample"],
      screenshots: [],
      installed: false,
      hasSettings: true,
      localResource: "programs/official/settings-gallery",
    },
  ];
  const community: CatalogProgram[] = [
    {
      id: "com.example.untrusted-demo",
      name: "Untrusted Demo",
      version: "0.1.0",
      summary: "Community-style sample used to demonstrate the trust warning.",
      license: "MIT",
      official: false,
      featured: false,
      sourceGithub: "example/untrusted-demo",
      permissions: ["network", "filesystem"],
      categories: ["sample"],
      tags: ["community"],
      screenshots: [],
      installed: false,
      hasSettings: false,
      localResource: "programs/examples/untrusted-demo",
    },
  ];
  switch (cmd) {
    case "get_store_settings":
      return {
        language: "en",
        themeId: "midnight",
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
        developerMode: true,
        verboseLogs: false,
        defenderExclusionConsent: false,
        isolationJobObject: false,
        telemetry: false,
        updateChannel: "stable",
        customCss: false,
      } satisfies StoreSettings;
    case "official_catalog":
      return official;
    case "community_catalog":
      return community;
    case "list_installed":
      return [];
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
      return [];
    case "check_updates":
      return [];
    case "get_program":
      return [...official, ...community].find((p) => p.id === args?.id) ?? official[0];
    case "search_github":
    case "search_theme_github":
      return community;
    case "program_logs":
      return "";
    case "get_program_settings":
      return { fontSize: 14, theme: "dark", autosave: true };
    case "program_status":
      return { id: args?.id, running: false };
    case "list_trust":
      return [];
    case "verify_program": {
      const req = (args?.request ?? {}) as { official?: boolean; id?: string };
      const officialId = req.official || req.id?.startsWith("com.muckstore.");
      return {
        programId: req.id ?? "unknown",
        name: officialId ? "Quick Notes" : "Untrusted Demo",
        official: Boolean(officialId),
        verdict: officialId ? "verified" : "needsApproval",
        github: officialId ? "muckstore/quick-notes" : "example/untrusted-demo",
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
              { id: "public", status: "warn", detail: "local community sample" },
              { id: "permissions", status: "pass", detail: "declared: network, filesystem" },
              { id: "workflow", status: "pass", detail: "not a Release binary — no Actions attestation required" },
            ],
      };
    }
    default:
      return null;
  }
}
