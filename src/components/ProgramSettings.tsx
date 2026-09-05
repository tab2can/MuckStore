import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useApp } from "../stores/useApp";
import { Switch } from "./ui/Switch";
import { Segmented } from "./ui/Segmented";
import { FilterSelect } from "./ui/FilterSelect";
import { SettingRow } from "./ui/SettingRow";
import type { ProgramRelease } from "../lib/types";

export function ProgramSettings() {
  const { t } = useTranslation();
  const id = useApp((s) => s.programSettingsId);
  const installed = useApp((s) => s.installed);
  const refresh = useApp((s) => s.refreshInstalled);
  const showNotice = useApp((s) => s.showNotice);
  const setOverlay = useApp((s) => s.setOverlay);
  const program = installed.find((p) => p.id === id);
  const [locked, setLocked] = useState(Boolean(program?.pinnedVersion));
  const [version, setVersion] = useState(program?.version ?? "");
  const [args, setArgs] = useState(program?.launchArgs ?? "");
  const [channel, setChannel] = useState(program?.updateChannel === "pre" ? "pre" : "stable");
  const [autostart, setAutostart] = useState(Boolean(program?.autostart));
  const [enabled, setEnabled] = useState(program?.enabled !== false);
  const [rememberAdmin, setRememberAdmin] = useState(Boolean(program?.rememberElevation));
  const [releases, setReleases] = useState<ProgramRelease[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!program) return;
    setLocked(Boolean(program.pinnedVersion));
    setVersion(program.pinnedVersion || program.version);
    setArgs(program.launchArgs ?? "");
    setChannel(program.updateChannel === "pre" ? "pre" : "stable");
    setAutostart(Boolean(program.autostart));
    setEnabled(program.enabled !== false);
    setRememberAdmin(Boolean(program.rememberElevation));
    void api
      .programReleases(program.id)
      .then(setReleases)
      .catch(() => setReleases([]));
  }, [program]);

  if (!program) {
    return (
      <div className="settings-page">
        <h1 className="page-title">{t("programSettings.title")}</h1>
        <p className="hint">{t("programSettings.missing")}</p>
      </div>
    );
  }

  const name = program.manifest.name;
  const canAutostart = program.manifest.permissions?.includes("autostart") ?? false;
  const versionOptions = (releases.length ? releases : [{ tag: program.version, prerelease: false }]).map(
    (r) => ({
      id: r.tag,
      label: r.prerelease ? `${r.tag} (${t("programSettings.pre")})` : r.tag,
    }),
  );
  if (program.version && !versionOptions.some((o) => o.id === program.version)) {
    versionOptions.unshift({ id: program.version, label: program.version });
  }
  const current = program;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.saveProgramInstallOptions({
        id: current.id,
        pinnedVersion: locked ? version : null,
        launchArgs: args,
        updateChannel: channel,
        rememberElevation: rememberAdmin,
        autostart,
        enabled,
      });
      if (version && version !== current.version) {
        await api.applyUpdate(current.id, version);
      }
      await refresh();
      showNotice(t("settings.saved"));
      setOverlay(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-page program-settings">
      <h1 className="page-title">{name}</h1>
      <p className="page-kicker">{t("programSettings.title")}</p>
      <section className="settings-card">
        <SettingRow title={t("programSettings.lock")} description={t("programSettings.lockHint")}>
          <Switch checked={locked} onChange={setLocked} label={t("programSettings.lock")} />
        </SettingRow>
        <SettingRow title={t("programSettings.version")} description={t("programSettings.versionHint")}>
          <FilterSelect
            value={version}
            onChange={setVersion}
            options={versionOptions}
            placeholder={program.version}
            label={t("programSettings.version")}
            allowEmpty={false}
            align="end"
          />
        </SettingRow>
        <SettingRow title={t("programSettings.args")} description={t("programSettings.argsHint")}>
          <input
            className="program-args"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder="-test"
            spellCheck={false}
          />
        </SettingRow>
        <SettingRow title={t("programSettings.channel")}>
          <Segmented
            value={channel}
            onChange={setChannel}
            options={[
              { id: "stable", label: t("programSettings.stable") },
              { id: "pre", label: t("programSettings.pre") },
            ]}
          />
        </SettingRow>
        <SettingRow
          title={t("programSettings.rememberAdmin")}
          description={t("programSettings.rememberAdminHint")}
        >
          <Switch
            checked={rememberAdmin}
            onChange={setRememberAdmin}
            label={t("programSettings.rememberAdmin")}
          />
        </SettingRow>
        <SettingRow title={t("programSettings.enabled")} description={t("programSettings.enabledHint")}>
          <Switch checked={enabled} onChange={setEnabled} label={t("programSettings.enabled")} />
        </SettingRow>
        <SettingRow
          title={t("programSettings.autostart")}
          description={canAutostart ? t("programSettings.autostartHint") : t("programSettings.autostartDenied")}
        >
          <Switch
            checked={autostart}
            disabled={!canAutostart}
            onChange={setAutostart}
            label={t("programSettings.autostart")}
          />
        </SettingRow>
        <SettingRow title={t("settings.installPath")} description={program.installPath}>
          <button className="btn sm" type="button" onClick={() => void api.openPath(program.installPath)}>
            {t("settings.openFolder")}
          </button>
        </SettingRow>
      </section>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn primary" type="button" disabled={busy} onClick={() => void save()}>
          {busy ? t("common.loading") : t("common.save")}
        </button>
        <button className="btn" type="button" onClick={() => setOverlay(null)}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
