import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useApp } from "../stores/useApp";
import type { ProcessStatus } from "../lib/types";
import { Switch } from "../components/ui/Switch";

export function Installed() {
  const { t } = useTranslation();
  const installed = useApp((s) => s.installed);
  const refresh = useApp((s) => s.refreshInstalled);
  const [status, setStatus] = useState<Record<string, ProcessStatus>>({});
  const [wipe, setWipe] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    const tick = async () => {
      const next: Record<string, ProcessStatus> = {};
      for (const p of installed) {
        next[p.id] = await api.status(p.id);
      }
      if (!cancel) setStatus(next);
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2500);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, [installed]);

  async function start(id: string) {
    setBusy(id);
    try {
      await api.start(id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="page-kicker">{t("nav.installed")}</p>
      <h1 className="page-title">{t("installed.title")}</h1>
      {installed.length === 0 ? (
        <div className="empty">{t("installed.empty")}</div>
      ) : (
        <div className="grid">
          {installed.map((p) => {
            const running = status[p.id]?.running;
            return (
              <article key={p.id} className="card">
                <div className="row">
                  <span className={`pill ${p.official ? "ok" : "warn"}`}>
                    {p.official ? t("detail.officialBadge") : t("detail.communityBadge")}
                  </span>
                  <span className={`pill ${running ? "ok" : ""}`}>{running ? "ON" : "OFF"}</span>
                </div>
                <h3>{p.manifest.name}</h3>
                <p>{p.manifest.summary}</p>
                <div className="row">
                  {running ? (
                    <button className="btn" type="button" onClick={() => void api.stop(p.id)}>
                      {t("installed.stop")}
                    </button>
                  ) : (
                    <button
                      className="btn primary"
                      type="button"
                      disabled={busy === p.id}
                      onClick={() => void start(p.id)}
                    >
                      {busy === p.id ? t("installed.starting") : t("installed.run")}
                    </button>
                  )}
                  <Link className="btn" to={`/program/${encodeURIComponent(p.id)}`}>
                    {t("installed.settings")}
                  </Link>
                  <button
                    className="btn danger"
                    type="button"
                    onClick={async () => {
                      await api.uninstall(p.id, wipe);
                      await refresh();
                    }}
                  >
                    {t("installed.uninstall")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {installed.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="row">
            <Switch checked={wipe} onChange={setWipe} label={t("installed.wipe")} />
            <span>{t("installed.wipe")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
