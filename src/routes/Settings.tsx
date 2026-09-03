import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  Code2,
  FolderOpen,
  Globe,
  Paintbrush,
  Power,
  RefreshCw,
  Shield,
} from "lucide-react";
import { enable, disable } from "@tauri-apps/plugin-autostart";
import { api, isTauri } from "../lib/api";
import type { StoreSettings, TrustRecord } from "../lib/types";
import { SUPPORTED_LOCALES } from "../i18n/catalog";
import { useNavWidth } from "../lib/navWidth";
import { useApp, type SettingsSection } from "../stores/useApp";
import { Switch } from "../components/ui/Switch";
import { Slider } from "../components/ui/Slider";
import { Segmented } from "../components/ui/Segmented";
import { FilterSelect } from "../components/ui/FilterSelect";
import { SettingRow } from "../components/ui/SettingRow";
import { UpdateInbox } from "../components/UpdateInbox";

const NAV_KEY = "muck-settings-nav-width";

const sections = [
  { id: "appearance", key: "settings.appearance", icon: Paintbrush },
  { id: "startup", key: "settings.startup", icon: Power },
  { id: "library", key: "settings.library", icon: FolderOpen },
  { id: "updates", key: "settings.updates", icon: RefreshCw },
  { id: "privacy", key: "settings.privacy", icon: Globe },
  { id: "security", key: "settings.security", icon: Shield },
  { id: "approvals", key: "settings.approvals", icon: BadgeCheck },
  { id: "developer", key: "settings.developer", icon: Code2 },
] as const;

export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useApp((s) => s.settings);
  const paths = useApp((s) => s.paths);
  const patch = useApp((s) => s.patchSettings);
  const showNotice = useApp((s) => s.showNotice);
  const [ledger, setLedger] = useState<TrustRecord[]>([]);
  const section = useApp((s) => s.settingsSection);
  const setSection = (id: SettingsSection) => useApp.setState({ settingsSection: id });
  const { width, collapsed, dragging, onResizePointerDown } = useNavWidth(NAV_KEY);

  useEffect(() => {
    void api.trustLedger().then(setLedger).catch(() => undefined);
  }, []);

  if (!settings) return null;

  async function commit<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    await patch({ [key]: value } as Partial<StoreSettings>);
    showNotice(t("settings.saved"));
  }

  return (
    <div
      className={`settings-page${collapsed ? " settings-nav-collapsed" : ""}${dragging ? " settings-nav-resizing" : ""}`}
      style={{ ["--settings-nav" as string]: `${width}px` }}
    >
      <h1 className="page-title">{t("settings.title")}</h1>
      <div className="settings-body">
        <aside className="settings-nav">
          <nav className="nav">
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-link${section === item.id ? " active" : ""}`}
                title={t(item.key)}
                aria-current={section === item.id ? "page" : undefined}
                onClick={() => setSection(item.id)}
              >
                <item.icon size={16} strokeWidth={1.75} />
                <span>{t(item.key)}</span>
              </button>
            ))}
          </nav>
          <div
            className="sidebar-resizer"
            onPointerDown={(e) => onResizePointerDown(e, ".settings-nav")}
            role="separator"
            aria-orientation="vertical"
            aria-label={t("nav.resizeSidebar")}
          />
        </aside>
        <div className="settings-pane">
          {section === "appearance" && (
            <section className="settings-card">
              <h2>{t("settings.appearance")}</h2>
              <p className="hint">{t("settings.appearanceHint")}</p>
              <SettingRow title={t("settings.language")} description={t("settings.languageHint")}>
                <FilterSelect
                  label={t("settings.language")}
                  placeholder={t("settings.system")}
                  allowEmpty={false}
                  align="end"
                  value={settings.language}
                  onChange={(v) => void commit("language", v)}
                  options={[
                    { id: "system", label: t("settings.system") },
                    ...SUPPORTED_LOCALES.map((locale) => ({ id: locale.id, label: locale.native })),
                  ]}
                />
              </SettingRow>
              <SettingRow title={t("settings.density")}>
                <Segmented
                  value={settings.density}
                  onChange={(v) => void commit("density", v)}
                  options={[
                    { id: "compact", label: t("settings.compact") },
                    { id: "comfortable", label: t("settings.comfortable") },
                    { id: "spacious", label: t("settings.spacious") },
                  ]}
                />
              </SettingRow>
              <SettingRow title={t("settings.sidebar")}>
                <Segmented
                  value={settings.sidebarPosition}
                  onChange={(v) => void commit("sidebarPosition", v)}
                  options={[
                    { id: "left", label: t("settings.left") },
                    { id: "right", label: t("settings.right") },
                  ]}
                />
              </SettingRow>
              <SettingRow title={t("settings.fontScale")} description={t("settings.fontScaleHint")}>
                <Slider
                  min={0.85}
                  max={1.25}
                  step={0.05}
                  value={settings.fontScale}
                  onChange={(v) => void commit("fontScale", v)}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
              </SettingRow>
              <SettingRow title={t("settings.mica")} description={t("settings.micaHint")}>
                <Switch checked={settings.mica} onChange={(v) => void commit("mica", v)} label={t("settings.mica")} />
              </SettingRow>
              <SettingRow title={t("settings.animations")}>
                <Switch
                  checked={settings.animations}
                  onChange={(v) => void commit("animations", v)}
                  label={t("settings.animations")}
                />
              </SettingRow>
              <SettingRow title={t("settings.reducedMotion")} description={t("settings.reducedMotionHint")}>
                <Switch
                  checked={settings.reducedMotion}
                  onChange={(v) => void commit("reducedMotion", v)}
                  label={t("settings.reducedMotion")}
                />
              </SettingRow>
            </section>
          )}

          {section === "startup" && (
            <section className="settings-card">
              <h2>{t("settings.startup")}</h2>
              <SettingRow title={t("settings.startWithWindows")}>
                <Switch
                  checked={settings.startWithWindows}
                  label={t("settings.startWithWindows")}
                  onChange={async (v) => {
                    if (v) {
                      await commit("startWithWindows", true);
                    } else {
                      await patch({ startWithWindows: false, startMinimized: false });
                      showNotice(t("settings.saved"));
                    }
                    if (isTauri) {
                      if (v) await enable();
                      else await disable();
                    }
                  }}
                />
              </SettingRow>
              <SettingRow title={t("settings.startMinimized")}>
                <Switch
                  checked={settings.startWithWindows && settings.startMinimized}
                  disabled={!settings.startWithWindows}
                  onChange={(v) => {
                    if (v && !settings.trayEnabled) {
                      void (async () => {
                        await patch({ startMinimized: true, trayEnabled: true });
                        showNotice(t("settings.saved"));
                      })();
                      return;
                    }
                    void commit("startMinimized", v);
                  }}
                  label={t("settings.startMinimized")}
                />
              </SettingRow>
              <SettingRow title={t("settings.tray")}>
                <Switch
                  checked={settings.trayEnabled}
                  onChange={(v) => {
                    if (!v && settings.startMinimized) {
                      void (async () => {
                        await patch({ trayEnabled: false, startMinimized: false });
                        showNotice(t("settings.saved"));
                      })();
                      return;
                    }
                    void commit("trayEnabled", v);
                  }}
                  label={t("settings.tray")}
                />
              </SettingRow>
            </section>
          )}

          {section === "library" && (
            <section className="settings-card">
              <h2>{t("settings.library")}</h2>
              <p className="hint">{t("settings.libraryHint")}</p>
              <SettingRow title={t("settings.dataRoot")} description={paths?.dataRoot}>
                <button className="btn sm" type="button" onClick={() => paths && void api.openPath(paths.dataRoot)}>
                  {t("settings.openFolder")}
                </button>
              </SettingRow>
              <SettingRow title={t("settings.configRoot")} description={paths?.config}>
                <button className="btn sm" type="button" onClick={() => paths && void api.openPath(paths.config)}>
                  {t("settings.openFolder")}
                </button>
              </SettingRow>
              <SettingRow title={t("settings.installPath")} description={paths?.programs}>
                <button className="btn sm" type="button" onClick={() => paths && void api.openPath(paths.programs)}>
                  {t("settings.openFolder")}
                </button>
              </SettingRow>
              <SettingRow title={t("settings.clearCache")} description={t("settings.clearCacheHint")}>
                <button className="btn sm" type="button" onClick={() => void api.clearCache()}>
                  {t("settings.clearCache")}
                </button>
              </SettingRow>
            </section>
          )}

          {section === "updates" && (
            <section className="settings-card">
              <h2>{t("settings.updates")}</h2>
              <p className="hint">{t("settings.updatesHint")}</p>
              <SettingRow title={t("settings.autoStore")} description={t("settings.autoStoreHint")}>
                <Segmented
                  value={settings.storeUpdatePolicy || (settings.autoUpdateStore ? "startup" : "manual")}
                  onChange={(v) => void commit("storeUpdatePolicy", v)}
                  options={[
                    { id: "auto", label: t("settings.updateAuto") },
                    { id: "startup", label: t("settings.updateStartup") },
                    { id: "manual", label: t("settings.updateManual") },
                  ]}
                />
              </SettingRow>
              <SettingRow title={t("settings.autoPrograms")} description={t("settings.autoProgramsHint")}>
                <Segmented
                  value={settings.programUpdatePolicy || (settings.autoUpdatePrograms === "auto" ? "auto" : settings.autoUpdatePrograms === "off" ? "manual" : "startup")}
                  onChange={(v) => void commit("programUpdatePolicy", v)}
                  options={[
                    { id: "auto", label: t("settings.updateAuto") },
                    { id: "startup", label: t("settings.updateStartup") },
                    { id: "manual", label: t("settings.updateManual") },
                  ]}
                />
              </SettingRow>
              <UpdateInbox />
            </section>
          )}

          {section === "privacy" && (
            <section className="settings-card">
              <h2>{t("settings.privacy")}</h2>
              <p className="hint">{t("settings.telemetryOff")}</p>
              <div className="field" style={{ padding: "12px 0 16px" }}>
                <span>{t("settings.githubToken")}</span>
                <input
                  type="password"
                  value={settings.githubToken ?? ""}
                  onChange={(e) => void commit("githubToken", e.target.value || null)}
                />
              </div>
              <div className="field" style={{ paddingBottom: 16 }}>
                <span>{t("settings.proxy")}</span>
                <input
                  value={settings.proxy ?? ""}
                  onChange={(e) => void commit("proxy", e.target.value || null)}
                />
              </div>
            </section>
          )}

          {section === "security" && (
            <section className="settings-card">
              <h2>{t("settings.security")}</h2>
              <SettingRow title={t("settings.warnThird")}>
                <Switch
                  checked={settings.warnThirdParty}
                  onChange={(v) => void commit("warnThirdParty", v)}
                  label={t("settings.warnThird")}
                />
              </SettingRow>
              <SettingRow title={t("settings.hashPolicy")}>
                <Segmented
                  value={settings.hashFailPolicy}
                  onChange={(v) => void commit("hashFailPolicy", v)}
                  options={[
                    { id: "reject", label: t("settings.reject") },
                    { id: "warn", label: t("settings.warn") },
                  ]}
                />
              </SettingRow>
              <SettingRow title={t("settings.isolation")} description={t("settings.isolationHint")}>
                <Switch
                  checked={settings.isolationJobObject}
                  onChange={(v) => void commit("isolationJobObject", v)}
                  label={t("settings.isolation")}
                />
              </SettingRow>
              <SettingRow title={t("settings.defender")} description={t("settings.defenderHint")}>
                <div className="row">
                  <Switch
                    checked={settings.defenderExclusionConsent}
                    onChange={(v) => void commit("defenderExclusionConsent", v)}
                    label={t("settings.defender")}
                  />
                  <button className="btn sm" type="button" onClick={() => void api.defenderExclusion()}>
                    UAC
                  </button>
                </div>
              </SettingRow>
            </section>
          )}

          {section === "approvals" && (
            <section className="settings-card">
              <h2>{t("settings.approvals")}</h2>
              <p className="hint">{t("settings.approvalsHint")}</p>
              {ledger.length === 0 ? (
                <p className="page-sub">{t("settings.noneApproved")}</p>
              ) : (
                ledger.map((rec) => (
                  <SettingRow
                    key={rec.id}
                    title={rec.id}
                    description={`${rec.version}${rec.commitSha ? ` · ${rec.commitSha.slice(0, 8)}` : ""}`}
                  >
                    <button
                      className="btn sm danger"
                      type="button"
                      onClick={async () => {
                        await api.revokeTrust(rec.id);
                        setLedger(await api.trustLedger());
                      }}
                    >
                      {t("settings.revoke")}
                    </button>
                  </SettingRow>
                ))
              )}
            </section>
          )}

          {section === "developer" && (
            <section className="settings-card">
              <h2>{t("settings.developer")}</h2>
              <SettingRow title={t("settings.developerMode")}>
                <Switch
                  checked={settings.developerMode}
                  onChange={(v) => void commit("developerMode", v)}
                  label={t("settings.developerMode")}
                />
              </SettingRow>
              <SettingRow title={t("settings.verbose")}>
                <Switch
                  checked={settings.verboseLogs}
                  onChange={(v) => void commit("verboseLogs", v)}
                  label={t("settings.verbose")}
                />
              </SettingRow>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
