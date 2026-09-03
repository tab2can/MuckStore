import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useApp } from "../stores/useApp";
import { LibraryRow } from "../components/LibraryRow";
import { wasUpdatedAfterInstall } from "../lib/catalogBrowse";
import type { InstalledProgram, ProcessStatus } from "../lib/types";

export function Library() {
  const { t } = useTranslation();
  const installed = useApp((s) => s.installed);
  const updates = useApp((s) => s.updates);
  const checking = useApp((s) => s.checkingUpdates);
  const checkUpdates = useApp((s) => s.checkUpdates);
  const [status, setStatus] = useState<Record<string, ProcessStatus>>({});
  const [starting, setStarting] = useState<string | null>(null);

  const pendingMap = useMemo(() => {
    const map = new Map(updates.filter((u) => u.available && !u.store && !u.pinned).map((u) => [u.id, u]));
    return map;
  }, [updates]);

  const { pending, recent, rest } = useMemo(() => {
    const pending: InstalledProgram[] = [];
    const recent: InstalledProgram[] = [];
    const rest: InstalledProgram[] = [];
    for (const program of installed) {
      if (pendingMap.has(program.id)) pending.push(program);
      else if (wasUpdatedAfterInstall(program)) recent.push(program);
      else rest.push(program);
    }
    pending.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
    recent.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    rest.sort((a, b) => b.installedAt.localeCompare(a.installedAt));
    return { pending, recent, rest };
  }, [installed, pendingMap]);

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
    setStarting(id);
    try {
      await api.start(id);
      setStatus((s) => ({ ...s, [id]: { id, running: true } }));
    } finally {
      setStarting(null);
    }
  }

  function section(title: string, programs: InstalledProgram[]) {
    if (programs.length === 0) return null;
    return (
      <section className="library-section">
        <div className="section-head">
          <h2>{title}</h2>
          <span className="section-count">{programs.length}</span>
        </div>
        <div className="library-table">
          <div className="library-cols" aria-hidden>
            <span />
            <span>{t("library.colName")}</span>
            <span>{t("library.colInstalled")}</span>
            <span>{t("library.colUpdated")}</span>
            <span>{t("library.colVersion")}</span>
            <span />
          </div>
          <div className="library-list">
            {programs.map((program) => (
              <LibraryRow
                key={program.id}
                program={program}
                running={status[program.id]?.running}
                starting={starting === program.id}
                update={pendingMap.get(program.id)}
                onStart={() => void start(program.id)}
                onStop={() => void api.stop(program.id).then(() => setStatus((s) => ({ ...s, [program.id]: { id: program.id, running: false } })))}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="library-page">
      <div className="library-head">
        <h1 className="page-title">{t("library.title")}</h1>
        <button className="btn" type="button" disabled={checking} onClick={() => void checkUpdates("manual")}>
          {checking ? t("updates.checking") : t("library.checkUpdates")}
        </button>
      </div>
      {installed.length === 0 ? (
        <div className="empty">{t("library.empty")}</div>
      ) : (
        <>
          {section(t("library.pending"), pending)}
          {section(t("library.recent"), recent)}
          {section(t("library.installed"), rest)}
        </>
      )}
    </div>
  );
}
