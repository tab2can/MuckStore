import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApp } from "../stores/useApp";
import { hasActionableUpdate, updateKind } from "../lib/updates";

export function UpdateInbox({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const updates = useApp((s) => s.updates);
  const checking = useApp((s) => s.checkingUpdates);
  const checkUpdates = useApp((s) => s.checkUpdates);
  const applyAllUpdates = useApp((s) => s.applyAllUpdates);
  const deferUpdates = useApp((s) => s.deferUpdates);
  const setOverlay = useApp((s) => s.setOverlay);
  const visible = updates.filter(
    (u) => hasActionableUpdate(u) || updateKind(u) === "catalog" || u.pinned,
  );
  const actionable = updates.filter(hasActionableUpdate);

  return (
    <div className={`update-inbox${compact ? " compact" : ""}`}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button
          className="btn"
          type="button"
          disabled={checking}
          onClick={() => void checkUpdates("manual")}
        >
          {checking ? t("updates.checking") : t("updates.checkNow")}
        </button>
      </div>
      {visible.length === 0 ? (
        <p className="hint">{checking ? t("updates.checking") : t("updates.none")}</p>
      ) : (
        <>
          <ul className="update-list">
            {visible.map((item) => {
              const kind = updateKind(item);
              return (
                <li key={`${kind}-${item.id}`} className="update-row">
                  <div>
                    <strong>{item.name || (item.store ? t("updates.store") : item.id)}</strong>
                    <span>
                      {kind === "catalog"
                        ? t("updates.catalogNew")
                        : item.pinned
                          ? t("updates.locked")
                          : item.available
                            ? `${item.current} → ${item.available}`
                            : item.current}
                    </span>
                  </div>
                  {kind === "catalog" && (
                    <button
                      className="btn sm"
                      type="button"
                      onClick={() => {
                        setOverlay(null);
                        navigate(`/program/${encodeURIComponent(item.id)}`);
                      }}
                    >
                      {t("updates.openProgram")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {actionable.length > 0 && (
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn primary" type="button" onClick={() => void applyAllUpdates()}>
                {t("updates.updateAll")}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  deferUpdates();
                  setOverlay(null);
                }}
              >
                {t("updates.later")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
