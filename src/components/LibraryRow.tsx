import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MoreHorizontal } from "lucide-react";
import type { InstalledProgram, UpdateInfo } from "../lib/types";
import {
  formatUpdated,
  installedIconUrl,
  programUpdatedAt,
} from "../lib/catalogBrowse";
import { api } from "../lib/api";
import { useApp } from "../stores/useApp";
import { motionEnabled } from "../lib/motion";

export function LibraryRow({
  program,
  running,
  starting,
  update,
  onStart,
  onStop,
}: {
  program: InstalledProgram;
  running?: boolean;
  starting?: boolean;
  update?: UpdateInfo;
  onStart: () => void;
  onStop: () => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const refresh = useApp((s) => s.refreshInstalled);
  const settings = useApp((s) => s.settings);
  const motion = motionEnabled(settings);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const icon = installedIconUrl(program);
  const name = program.manifest.i18n?.[i18n.language]?.name ?? program.manifest.name;
  const installed = formatUpdated(program.installedAt, i18n.language) ?? "—";
  const updated = formatUpdated(programUpdatedAt(program), i18n.language) ?? "—";
  const version = update?.available ? `${program.version} → ${update.available}` : program.version;

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <article className="library-row">
      {icon ? (
        <img className="library-icon" src={icon} alt="" />
      ) : (
        <span className="library-icon fallback" aria-hidden>
          {name.slice(0, 1)}
        </span>
      )}
      <Link className="library-name" to={`/program/${encodeURIComponent(program.id)}`}>
        {name}
      </Link>
      <span className="library-cell">{installed}</span>
      <span className="library-cell">{updated}</span>
      <span className="library-cell mono">{version}</span>
      <div className="library-actions">
        {running ? (
          <button className="btn sm" type="button" onClick={onStop}>
            {t("installed.stop")}
          </button>
        ) : (
          <button className="btn sm primary" type="button" disabled={starting} onClick={onStart}>
            {starting ? t("installed.starting") : t("installed.run")}
          </button>
        )}
        <div className={`library-more${menu ? " open" : ""}`} ref={root}>
          <button
            className="btn sm ghost library-more-btn"
            type="button"
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={t("library.more")}
            onClick={() => setMenu((v) => !v)}
          >
            <MoreHorizontal size={16} />
          </button>
          {menu && (
            <div className={`filter-menu library-menu${motion ? " anim" : ""}`} role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  navigate(`/program/${encodeURIComponent(program.id)}`);
                }}
              >
                {t("library.open")}
              </button>
              {update?.available && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api.applyUpdate(program.id);
                      await refresh();
                      const list = await api.updates();
                      useApp.setState({ updates: list });
                    } finally {
                      setBusy(false);
                      setMenu(false);
                    }
                  }}
                >
                  {t("updates.apply")}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.uninstall(program.id, false);
                    await refresh();
                  } finally {
                    setBusy(false);
                    setMenu(false);
                  }
                }}
              >
                {t("installed.uninstall")}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
