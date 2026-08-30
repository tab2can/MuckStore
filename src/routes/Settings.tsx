import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { enable, disable } from "@tauri-apps/plugin-autostart";
import { api, isTauri } from "../lib/api";
import type { StoreSettings, TrustRecord } from "../lib/types";
import { BUILTIN_THEMES } from "../lib/themes";
import { useApp } from "../stores/useApp";
import { Switch } from "../components/ui/Switch";
import { Slider } from "../components/ui/Slider";
import { Segmented } from "../components/ui/Segmented";
import { SettingRow } from "../components/ui/SettingRow";

export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useApp((s) => s.settings);
  const paths = useApp((s) => s.paths);
  const patch = useApp((s) => s.patchSettings);
  const [saved, setSaved] = useState(false);
  const [ledger, setLedger] = useState<TrustRecord[]>([]);

  useEffect(() => {
    void api.trustLedger().then(setLedger).catch(() => undefined);
  }, []);

  if (!settings) return null;

  async function commit<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    await patch({ [key]: value } as Partial<StoreSettings>);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  return (
    <div>
      <p className="page-kicker">{t("nav.settings")}</p>
      <h1 className="page-title">{t("settings.title")}</h1>
      <p className="page-sub">{t("settings.subtitle")}</p>
      {saved && <p className="pill ok">{t("settings.saved")}</p>}

      <div className="settings-layout">
        <nav className="settings-toc">
          <a href="#appearance">{t("settings.appearance")}</a>
          <a href="#startup">{t("settings.startup")}</a>
          <a href="#library">{t("settings.library")}</a>
          <a href="#updates">{t("settings.updates")}</a>
          <a href="#privacy">{t("settings.privacy")}</a>
          <a href="#security">{t("settings.security")}</a>
          <a href="#approvals">{t("settings.approvals")}</a>
          <a href="#developer">{t("settings.developer")}</a>
        </nav>

        <div>
          <section className="settings-card" id="appearance">
            <h2>{t("settings.appearance")}</h2>
            <p className="hint">{t("settings.appearanceHint")}</p>
            <SettingRow title={t("settings.language")} description={t("settings.languageHint")}>
              <Segmented
                value={settings.language}
                onChange={(v) => void commit("language", v)}
                options={[
                  { id: "en", label: "EN" },
                  { id: "tr", label: "TR" },
                ]}
              />
            </SettingRow>
            <SettingRow title={t("settings.theme")}>
              <select
                value={settings.themeId}
                onChange={(e) => void commit("themeId", e.target.value)}
              >
                {BUILTIN_THEMES.map((th) => (
                  <option key={th.id} value={th.id}>
                    {th.name}
                  </option>
                ))}
              </select>
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

          <section className="settings-card" id="startup">
            <h2>{t("settings.startup")}</h2>
            <p className="hint">{t("settings.startupHint")}</p>
            <SettingRow title={t("settings.startWithWindows")} description={t("settings.startWithWindowsHint")}>
              <Switch
                checked={settings.startWithWindows}
                label={t("settings.startWithWindows")}
                onChange={async (v) => {
                  await commit("startWithWindows", v);
                  if (isTauri) {
                    if (v) await enable();
                    else await disable();
                  }
                }}
              />
            </SettingRow>
            <SettingRow title={t("settings.startMinimized")}>
              <Switch
                checked={settings.startMinimized}
                onChange={(v) => void commit("startMinimized", v)}
                label={t("settings.startMinimized")}
              />
            </SettingRow>
            <SettingRow title={t("settings.tray")}>
              <Switch
                checked={settings.trayEnabled}
                onChange={(v) => void commit("trayEnabled", v)}
                label={t("settings.tray")}
              />
            </SettingRow>
          </section>

          <section className="settings-card" id="library">
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

          <section className="settings-card" id="updates">
            <h2>{t("settings.updates")}</h2>
            <p className="hint">{t("settings.updatesHint")}</p>
            <SettingRow title={t("settings.autoStore")} description={t("settings.autoStoreHint")}>
              <Switch
                checked={settings.autoUpdateStore}
                onChange={(v) => void commit("autoUpdateStore", v)}
                label={t("settings.autoStore")}
              />
            </SettingRow>
            <SettingRow title={t("settings.autoPrograms")}>
              <Segmented
                value={settings.autoUpdatePrograms}
                onChange={(v) => void commit("autoUpdatePrograms", v)}
                options={[
                  { id: "auto", label: t("settings.auto") },
                  { id: "notify", label: t("settings.notify") },
                  { id: "off", label: t("settings.off") },
                ]}
              />
            </SettingRow>
          </section>

          <section className="settings-card" id="privacy">
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

          <section className="settings-card" id="security">
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

          <section className="settings-card" id="approvals">
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

          <section className="settings-card" id="developer">
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
        </div>
      </div>
    </div>
  );
}
