export type Permission =
  | "network"
  | "filesystem"
  | "autostart"
  | "input-hook"
  | "clipboard"
  | "notifications"
  | "screenshot"
  | "shell-integration"
  | "other-process"
  | "windows-settings"
  | "admin";

export interface ManifestI18n {
  name?: string;
  summary?: string;
  description?: string;
}

export interface SettingProperty {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  "x-muck-widget"?: string;
}

export interface SettingsSchema {
  type: "object";
  title?: string;
  properties?: Record<string, SettingProperty>;
}

export interface MuckManifest {
  id: string;
  name: string;
  version: string;
  license: string;
  summary: string;
  description?: string;
  categories?: string[];
  tags?: string[];
  source: { github: string };
  entry: string;
  install: {
    kind: string;
    assets?: { file: string; platform: string; sha256: string; url?: string }[];
    shortcuts?: { startMenu?: boolean; desktop?: boolean };
  };
  runtimes?: { id: string; version?: string; strategy?: string }[];
  permissions?: string[];
  settings?: { schema?: SettingsSchema };
  watchdog?: { onCrash?: string; maxRestarts?: number };
  i18n?: Record<string, ManifestI18n>;
  ui?: { icon?: string; screenshots?: string[]; accent?: string };
  build?: {
    workflow: string;
    reproducible?: boolean;
    attestations?: "required";
  };
}

export interface CatalogProgram {
  id: string;
  name: string;
  version: string;
  summary: string;
  description?: string | null;
  license: string;
  official: boolean;
  featured: boolean;
  sourceGithub: string;
  stars?: number | null;
  forks?: number | null;
  language?: string | null;
  updatedAt?: string | null;
  ownerAvatar?: string | null;
  readme?: string | null;
  permissions: string[];
  categories: string[];
  tags: string[];
  icon?: string | null;
  screenshots: string[];
  installed: boolean;
  installedVersion?: string | null;
  hasSettings: boolean;
  localResource?: string | null;
  manifest?: MuckManifest | null;
  archived?: boolean;
  commitSha?: string | null;
  htmlUrl?: string | null;
}

export interface InstalledProgram {
  id: string;
  version: string;
  installPath: string;
  official: boolean;
  sourceGithub: string;
  enabled: boolean;
  autostart: boolean;
  pinnedVersion?: string | null;
  updateChannel: string;
  launchArgs?: string;
  installedAt: string;
  updatedAt?: string | null;
  manifest: MuckManifest;
  inventory: string[];
  previousPath?: string | null;
}

export interface StoreSettings {
  language: string;
  themeId: string;
  density: string;
  sidebarPosition: string;
  mica: boolean;
  accent?: string | null;
  animations: boolean;
  reducedMotion: boolean;
  fontScale: number;
  startWithWindows: boolean;
  startMinimized: boolean;
  trayEnabled: boolean;
  installPath?: string | null;
  githubToken?: string | null;
  proxy?: string | null;
  warnThirdParty: boolean;
  hashFailPolicy: string;
  autoUpdateStore: boolean;
  autoUpdatePrograms: string;
  storeUpdatePolicy: string;
  programUpdatePolicy: string;
  lastUpdateCheckAt?: string | null;
  updateCheckBackoffUntil?: string | null;
  lastCatalogIds?: string[];
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  developerMode: boolean;
  sideloadPath?: string | null;
  verboseLogs: boolean;
  defenderExclusionConsent: boolean;
  isolationJobObject: boolean;
  telemetry: boolean;
  updateChannel: string;
  customCss: boolean;
  prefsRevision?: number;
}

export interface ThemePack {
  id: string;
  name: string;
  author?: string | null;
  tokens: Record<string, string>;
}

export interface InstallRequest {
  github?: string | null;
  localResource?: string | null;
  id?: string | null;
  trustAccepted: boolean;
  official: boolean;
  version?: string | null;
}

export interface VerifyCheck {
  id: string;
  status: "pass" | "warn" | "fail" | string;
  detail: string;
}

export interface VerifyReport {
  programId: string;
  name: string;
  official: boolean;
  verdict: "verified" | "needsApproval" | "blocked" | string;
  github: string;
  version: string;
  commitSha?: string | null;
  checks: VerifyCheck[];
}

export interface TrustRecord {
  id: string;
  github: string;
  version: string;
  commitSha?: string | null;
  official: boolean;
  approvedAt: string;
  verdict: string;
}

export interface ProcessStatus {
  id: string;
  running: boolean;
  pid?: number | null;
}

export interface UpdateInfo {
  id: string;
  current: string;
  available?: string | null;
  changelog?: string | null;
  store: boolean;
  kind?: string;
  name?: string;
  pinned?: boolean;
}

export interface ProgramRelease {
  tag: string;
  prerelease: boolean;
  body?: string | null;
}

export interface AppPaths {
  programs: string;
  config: string;
  cache: string;
  logs: string;
  themes: string;
  runtimes: string;
  dataRoot: string;
}
