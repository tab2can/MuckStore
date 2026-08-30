import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { api, isTauri } from "../lib/api";
import { useApp } from "../stores/useApp";
import { PermissionChips } from "../components/PermissionChips";
import { TrustDialog } from "../components/TrustDialog";
import { MarkdownView } from "../components/MarkdownView";
import { SettingsForm } from "../components/SettingsForm";
import { Switch } from "../components/ui/Switch";
import type { CatalogProgram, SettingsSchema, VerifyReport } from "../lib/types";

export function ProgramDetail() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const official = useApp((s) => s.official);
  const community = useApp((s) => s.community);
  const discovered = useApp((s) => s.discovered);
  const installed = useApp((s) => s.installed);
  const refresh = useApp((s) => s.refreshInstalled);
  const [remote, setRemote] = useState<CatalogProgram | null>(null);
  const [trust, setTrust] = useState(false);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [logs, setLogs] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);

  const program = useMemo(() => {
    return (
      official.find((p) => p.id === id) ??
      community.find((p) => p.id === id) ??
      discovered.find((p) => p.id === id) ??
      remote ??
      null
    );
  }, [official, community, discovered, id, remote]);

  const inst = installed.find((p) => p.id === id);
  const schema = (inst?.manifest.settings?.schema ?? program?.manifest?.settings?.schema) as
    | SettingsSchema
    | undefined;

  useEffect(() => {
    if (!program) {
      void api.getProgram(id).then(setRemote).catch(() => undefined);
    }
  }, [id, program]);

  useEffect(() => {
    if (!inst) return;
    void api.programSettings(inst.id).then(setValues);
    void api.logs(inst.id).then(setLogs);
    void api.status(inst.id).then((s) => setRunning(s.running));
  }, [inst]);

  useEffect(() => {
    if (!isTauri) return;
    let un: (() => void) | undefined;
    void listen<{ message: string; percent: number }>("install-progress", (e) => {
      setProgress(`${e.payload.percent}% ${e.payload.message}`);
    }).then((fn) => {
      un = fn;
    });
    return () => {
      un?.();
    };
  }, []);

  async function doInstall(trustAccepted: boolean) {
    if (!program) return;
    setBusy(true);
    setError(null);
    try {
      const request = {
        id: program.id,
        localResource: program.localResource,
        github: program.localResource ? null : program.sourceGithub,
        official: program.official,
        trustAccepted,
      };
      if (!trustAccepted) {
        const next = await api.verify(request);
        setReport(next);
        setTrust(true);
        return;
      }
      if (report?.verdict === "blocked") {
        return;
      }
      await api.install({
        ...request,
        trustAccepted: true,
      });
      await refresh();
      setTrust(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("trust_required")) {
        try {
          const next = await api.verify({
            id: program.id,
            localResource: program.localResource,
            github: program.localResource ? null : program.sourceGithub,
            official: program.official,
            trustAccepted: false,
          });
          setReport(next);
        } catch {
          /* report optional */
        }
        setTrust(true);
      } else if (msg.includes("verification_blocked")) {
        setError(t("trust.blockedHint"));
        setTrust(true);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!program) {
    return <p>{t("common.loading")}</p>;
  }

  const loc = program.manifest?.i18n?.[i18n.language];

  return (
    <div>
      <p className="page-kicker">{program.sourceGithub}</p>
      <h1 className="page-title">{loc?.name ?? program.name}</h1>
      <p className="page-sub">{loc?.summary ?? program.summary}</p>
      <div className="row" style={{ marginBottom: 18 }}>
        <span className={`pill ${program.official ? "ok" : "warn"}`}>
          {program.official ? t("detail.officialBadge") : t("detail.communityBadge")}
        </span>
        <span className="pill">{program.version}</span>
        <span className="pill">{program.license}</span>
        {program.stars != null && (
          <span className="pill">
            {t("detail.stars")} {program.stars}
          </span>
        )}
      </div>
      <PermissionChips permissions={program.permissions} />
      <div className="row" style={{ margin: "18px 0 28px" }}>
        {inst ? (
          <>
            {running ? (
              <button className="btn" type="button" onClick={() => void api.stop(id).then(() => setRunning(false))}>
                {t("installed.stop")}
              </button>
            ) : (
              <button
                className="btn primary"
                type="button"
                disabled={starting}
                onClick={async () => {
                  setStarting(true);
                  setError(null);
                  try {
                    await api.start(id);
                    setRunning(true);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setStarting(false);
                  }
                }}
              >
                {starting ? t("installed.starting") : t("installed.run")}
              </button>
            )}
            <button className="btn" type="button" onClick={() => void api.openPath(inst.installPath)}>
              {t("installed.folder")}
            </button>
            <button
              className="btn danger"
              type="button"
              onClick={async () => {
                await api.uninstall(id, false);
                await refresh();
              }}
            >
              {t("installed.uninstall")}
            </button>
          </>
        ) : (
          <button className="btn primary" type="button" disabled={busy} onClick={() => void doInstall(false)}>
            {busy ? t("common.loading") : t("detail.install")}
          </button>
        )}
      </div>
      {progress && <p>{progress}</p>}
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {inst && schema && (
        <section className="section">
          <h2>{t("programSettings.title")}</h2>
          <SettingsForm schema={schema} value={values} onChange={setValues} />
          <button
            className="btn primary"
            type="button"
            style={{ marginTop: 12 }}
            onClick={() => void api.saveProgramSettings(id, values)}
          >
            {t("programSettings.save")}
          </button>
        </section>
      )}

      {inst && (
        <section className="section">
          <h2>{t("installed.logs")}</h2>
          <pre className="logs">{logs || "—"}</pre>
          <label className="row" style={{ marginTop: 10, gap: 12 }}>
            <Switch
              checked={inst.autostart}
              onChange={(v) => void api.setAutostart(id, v).then(() => refresh())}
              label={t("installed.autostart")}
            />
            {t("installed.autostart")}
          </label>
        </section>
      )}

      <section className="section">
        <h2>{t("detail.readme")}</h2>
        {program.readme ? <MarkdownView source={program.readme} /> : <p>{t("detail.noReadme")}</p>}
      </section>

      {trust && (
        <TrustDialog
          name={program.name}
          repo={program.sourceGithub}
          permissions={program.permissions}
          report={report}
          onCancel={() => setTrust(false)}
          onAccept={() => void doInstall(true)}
        />
      )}
    </div>
  );
}
