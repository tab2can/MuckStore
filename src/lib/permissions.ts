export const PERMISSION_META: Record<string, { tone: "ok" | "warn" | "danger" }> = {
  network: { tone: "ok" },
  filesystem: { tone: "warn" },
  autostart: { tone: "warn" },
  clipboard: { tone: "ok" },
  notifications: { tone: "ok" },
  screenshot: { tone: "warn" },
  "input-hook": { tone: "danger" },
  "shell-integration": { tone: "danger" },
  "other-process": { tone: "danger" },
  "windows-settings": { tone: "danger" },
  admin: { tone: "danger" },
};
