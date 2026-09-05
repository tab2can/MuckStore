import { invoke } from "@tauri-apps/api/core";
import type {
  AppPaths,
  CatalogProgram,
  InstallRequest,
  InstalledProgram,
  MuckManifest,
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

function mockShot(id: string, title: string, i: number) {
  const h = (id.length * 37 + i * 53) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${h},42%,24%)"/><stop offset="1" stop-color="hsl(${(h + 50) % 360},38%,12%)"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><text x="72" y="340" fill="#f3efe8" font-size="54" font-family="Segoe UI,sans-serif">${title}</text><text x="72" y="400" fill="rgba(243,239,232,.55)" font-size="22" font-family="Segoe UI,sans-serif">${i + 1} / 3</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function shots(id: string, title: string) {
  return [0, 1, 2].map((i) => mockShot(id, title, i));
}

function mockAppIcon(id: string, letter: string) {
  const h = (id.length * 41) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="hsl(${h},36%,20%)"/><text x="32" y="42" text-anchor="middle" fill="#f3efe8" font-size="26" font-family="Segoe UI,sans-serif">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function mockInstalledOf(
  id: string,
  name: string,
  version: string,
  official: boolean,
  github: string,
  installedAt: string,
  updatedAt: string,
  letter: string,
): InstalledProgram {
  const manifest: MuckManifest = {
    id,
    name,
    version,
    license: "MIT",
    summary: name,
    source: { github },
    entry: "app.exe",
    install: { kind: "portable" },
    ui: { icon: mockAppIcon(id, letter) },
  };
  return {
    id,
    version,
    installPath: `%LOCALAPPDATA%\\MuckStore\\programs\\${id}\\${version}`,
    official,
    sourceGithub: github,
    enabled: true,
    autostart: false,
    updateChannel: "stable",
    launchArgs: "",
    rememberElevation: false,
    installedAt,
    updatedAt,
    manifest,
    inventory: [],
  };
}

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
    mockInstalled = [
      mockInstalledOf(
        "com.demo.copper-term",
        "Copper Term",
        "1.0.0",
        false,
        "demo/copper-term",
        "2026-06-04T10:00:00Z",
        "2026-06-04T10:00:00Z",
        "C",
      ),
      mockInstalledOf(
        "com.demo.lantern",
        "Lantern",
        "1.4.2",
        false,
        "demo/lantern",
        "2026-05-12T09:00:00Z",
        "2026-08-20T14:30:00Z",
        "L",
      ),
      mockInstalledOf(
        "com.demo.harbor",
        "Harbor",
        "2.1.0",
        false,
        "demo/harbor",
        "2026-08-28T16:12:00Z",
        "2026-08-28T16:12:00Z",
        "H",
      ),
      mockInstalledOf(
        "com.muckstore.quick-notes",
        "Quick Notes",
        "1.0.0",
        true,
        "muckstore/quick-notes",
        "2026-07-02T11:40:00Z",
        "2026-07-02T11:40:00Z",
        "Q",
      ),
    ];
  }
  return mockInstalled;
}

function mockProgram(
  partial: Partial<CatalogProgram> & Pick<CatalogProgram, "id" | "name" | "summary" | "sourceGithub">,
): CatalogProgram {
  return {
    version: "1.0.0",
    license: "MIT",
    official: false,
    featured: false,
    permissions: ["filesystem"],
    categories: ["utility"],
    tags: [],
    screenshots: [],
    installed: false,
    hasSettings: false,
    ...partial,
  };
}

function mock(cmd: string, args?: Record<string, unknown>): unknown {
  const official: CatalogProgram[] = [
    mockProgram({
      id: "com.muckstore.quick-notes",
      name: "Quick Notes",
      summary: "A portable notes pad that stores text next to the program.",
      official: true,
      featured: true,
      sourceGithub: "muckstore/quick-notes",
      permissions: ["filesystem", "autostart"],
      categories: ["productivity"],
      tags: ["notes"],
      hasSettings: true,
      localResource: "programs/official/quick-notes",
      readme: "Official sample. No Muck SDK.",
      stars: 128,
      forks: 14,
      language: "PowerShell",
    }),
    mockProgram({
      id: "com.muckstore.settings-gallery",
      name: "Settings Gallery",
      summary: "Shows every Muck settings widget.",
      official: true,
      sourceGithub: "muckstore/settings-gallery",
      categories: ["developer"],
      tags: ["sample"],
      hasSettings: true,
      localResource: "programs/official/settings-gallery",
      stars: 41,
      forks: 6,
      language: "PowerShell",
    }),
  ];
  const community: CatalogProgram[] = [
    mockProgram({
      id: "com.example.untrusted-demo",
      name: "Untrusted Demo",
      version: "0.1.0",
      summary: "Community-style sample used to demonstrate the trust warning.",
      sourceGithub: "example/untrusted-demo",
      permissions: ["network", "filesystem"],
      categories: ["sample"],
      tags: ["community"],
      localResource: "programs/examples/untrusted-demo",
      stars: 8,
      forks: 2,
      language: "PowerShell",
    }),
  ];
  const discovered: CatalogProgram[] = [
    mockProgram({
      id: "com.demo.copper-term",
      name: "Copper Term",
      summary: "A small terminal companion with session notes and copper accents.",
      sourceGithub: "demo/copper-term",
      categories: ["developer"],
      stars: 4200,
      forks: 380,
      language: "Rust",
      license: "Apache-2.0",
      htmlUrl: "https://github.com/demo/copper-term",
      updatedAt: "2026-08-12T10:00:00Z",
      screenshots: shots("copper-term", "Copper Term"),
      readme: "## Copper Term\n\nA portable terminal companion. Sessions stay next to the binary.\n\n- Copper accents\n- Session notes\n- No account",
    }),
    mockProgram({
      id: "com.demo.lantern",
      name: "Lantern",
      summary: "Local-first markdown wiki that stays in one folder.",
      sourceGithub: "demo/lantern",
      categories: ["productivity"],
      stars: 3100,
      forks: 210,
      language: "TypeScript",
      htmlUrl: "https://github.com/demo/lantern",
      updatedAt: "2026-08-20T10:00:00Z",
      screenshots: shots("lantern", "Lantern"),
      readme: "## Lantern\n\nA wiki in a folder. Link pages, keep them local.",
    }),
    mockProgram({
      id: "com.demo.harbor",
      name: "Harbor",
      summary: "Download manager with checksums and portable extracts.",
      sourceGithub: "demo/harbor",
      categories: ["utility"],
      stars: 2740,
      forks: 640,
      language: "Go",
      license: "BSD-3-Clause",
      htmlUrl: "https://github.com/demo/harbor",
      updatedAt: "2026-07-30T10:00:00Z",
      screenshots: shots("harbor", "Harbor"),
      readme: "## Harbor\n\nDownloads, checksums, extracts. Nothing leaves this PC except the file you asked for.",
    }),
    mockProgram({
      id: "com.demo.quill",
      name: "Quill",
      summary: "Plain-text editor with a quiet status bar.",
      sourceGithub: "demo/quill",
      categories: ["productivity"],
      stars: 1980,
      forks: 92,
      language: "C#",
    }),
    mockProgram({
      id: "com.demo.prism-clip",
      name: "Prism Clip",
      summary: "Clipboard history that never leaves this PC.",
      sourceGithub: "demo/prism-clip",
      categories: ["utility"],
      stars: 1640,
      forks: 118,
      language: "TypeScript",
    }),
    mockProgram({
      id: "com.demo.oak-sync",
      name: "Oak Sync",
      summary: "Folder mirroring with a visible conflict list.",
      sourceGithub: "demo/oak-sync",
      categories: ["utility"],
      stars: 1512,
      forks: 430,
      language: "Python",
      license: "GPL-3.0",
    }),
    mockProgram({
      id: "com.demo.nimbus",
      name: "Nimbus",
      summary: "Weather tray app that reads a public forecast feed.",
      sourceGithub: "demo/nimbus",
      categories: ["lifestyle"],
      stars: 980,
      forks: 77,
      language: "Python",
    }),
    mockProgram({
      id: "com.demo.ledger-lite",
      name: "Ledger Lite",
      summary: "CSV-backed spending log with monthly totals.",
      sourceGithub: "demo/ledger-lite",
      categories: ["productivity"],
      stars: 860,
      forks: 54,
      language: "Rust",
    }),
    mockProgram({
      id: "com.demo.mosaic",
      name: "Mosaic",
      summary: "Image board for local folders, no account required.",
      sourceGithub: "demo/mosaic",
      categories: ["media"],
      stars: 720,
      forks: 310,
      language: "C#",
      htmlUrl: "https://github.com/demo/mosaic",
      updatedAt: "2026-08-02T10:00:00Z",
      screenshots: shots("mosaic", "Mosaic"),
      readme: "## Mosaic\n\nBrowse a folder of images. No cloud, no account.",
    }),
    mockProgram({
      id: "com.demo.wiretap-ui",
      name: "Packet Desk",
      summary: "Read-only packet summary for a home lab NIC.",
      sourceGithub: "demo/packet-desk",
      categories: ["developer"],
      stars: 640,
      forks: 88,
      language: "Go",
      license: "Apache-2.0",
    }),
    mockProgram({
      id: "com.demo.hearth",
      name: "Hearth",
      summary: "A quiet Pomodoro timer that writes sessions to disk.",
      sourceGithub: "demo/hearth",
      categories: ["productivity"],
      stars: 510,
      forks: 41,
      language: "TypeScript",
    }),
    mockProgram({
      id: "com.demo.sprout",
      name: "Sprout",
      summary: "Seed a new portable app folder from a template.",
      sourceGithub: "demo/sprout",
      categories: ["developer"],
      stars: 390,
      forks: 205,
      language: "Python",
    }),
  ];
  switch (cmd) {
    case "get_store_settings":
      return mockSettings ?? (mockSettings = defaultMockSettings());
    case "save_store_settings":
      mockSettings = args?.settings as StoreSettings;
      return null;
    case "official_catalog":
      return official;
    case "community_catalog":
      return community;
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
    case "check_updates": {
      const items: UpdateInfo[] = [
        {
          id: "com.muckstore.app",
          current: "1.0.0",
          available: "1.0.1",
          store: true,
          kind: "store",
          name: "Muck Store",
          pinned: false,
        },
      ];
      if (ensureMockInstalled().some((p) => p.id === "com.demo.copper-term" && p.version === "1.0.0")) {
        items.push({
          id: "com.demo.copper-term",
          current: "1.0.0",
          available: "1.2.0",
          changelog: "Session notes polish.",
          store: false,
          kind: "program",
          name: "Copper Term",
          pinned: false,
        });
      }
      return items;
    }
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
      return [...official, ...community, ...discovered].find((p) => p.id === args?.id) ?? official[0];
    case "search_github":
    case "search_theme_github":
      return discovered;
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
