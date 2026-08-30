import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { api, isTauri } from "../lib/api";
import { useApp } from "../stores/useApp";

export function Updates() {
  const { t } = useTranslation();
  const updates = useApp((s) => s.updates);
  const refresh = useApp((s) => s.refreshInstalled);
  const hydrate = useApp((s) => s.hydrate);
  const [busy, setBusy] = useState<string | null>(null);
  const [storeBusy, setStoreBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);

  const pending = updates.filter((u) => u.available);

  async function refreshAll() {
    setStatus(t("updates.checking"));
    const list = await api.updates();
    useApp.setState({ updates: list });
    setStatus(null);
  }

  useEffect(() => {
    if (!isTauri) return;
    let un: (() => void) | undefined;
    void listen("tray-check-updates", () => {
      void refreshAll();
    }).then((fn) => {
      un = fn;
    });
    return () => un?.();
  }, []);

  return (
    <div>
      <p className="page-kicker">{t("nav.updates")}</p>
      <h1 className="page-title">{t("updates.title")}</h1>
      <p className="page-sub">{t("updates.subtitle")}</p>
      <div className="row" style={{ marginBottom: 18 }}>
        <button className="btn" type="button" disabled={Boolean(status)} onClick={() => void refreshAll()}>
          {status ?? t("updates.checkNow")}
        </button>
        {isTauri && (
          <button
            className="btn primary"
            type="button"
            disabled={storeBusy}
            onClick={async () => {
              setStoreBusy(true);
              setStoreError(null);
              try {
                await api.launchUpdater();
              } catch (e) {
                setStoreError(e instanceof Error ? e.message : String(e));
                setStoreBusy(false);
              }
            }}
          >
            {t("updates.openUpdater")}
          </button>
        )}
      </div>
      {storeError && <p style={{ color: "var(--danger)" }}>{storeError}</p>}
      {pending.length === 0 ? (
        <div className="empty">{t("updates.none")}</div>
      ) : (
        <div className="grid">
          {pending.map((u) => (
            <article key={u.id} className="card">
              <h3>{u.store ? t("updates.store") : u.id}</h3>
              <p>
                {u.current} → {u.available}
              </p>
              {u.changelog && <p>{u.changelog.slice(0, 240)}</p>}
              <div className="row">
                {u.store ? (
                  <button
                    className="btn primary"
                    type="button"
                    disabled={storeBusy}
                    onClick={async () => {
                      setStoreBusy(true);
                      try {
                        await api.launchUpdater();
                      } catch {
                        setStoreBusy(false);
                      }
                    }}
                  >
                    {t("updates.apply")}
                  </button>
                ) : (
                  <>
                    <button
                      className="btn primary"
                      type="button"
                      disabled={busy === u.id}
                      onClick={async () => {
                        setBusy(u.id);
                        await api.applyUpdate(u.id);
                        await refresh();
                        await hydrate();
                        setBusy(null);
                      }}
                    >
                      {t("updates.apply")}
                    </button>
                    <button className="btn" type="button" onClick={() => void api.rollback(u.id)}>
                      {t("updates.rollback")}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
