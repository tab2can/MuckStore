import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GitFork, Star } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { api, isTauri } from "../lib/api";
import { useApp } from "../stores/useApp";
import { PermissionChips } from "../components/PermissionChips";
import { TrustDialog } from "../components/TrustDialog";
import { MarkdownView } from "../components/MarkdownView";
import { ShotCarousel } from "../components/ShotCarousel";
import {
  formatCount,
  formatUpdated,
  githubUrl,
  programGallery,
  programLanguage,
} from "../lib/catalogBrowse";
import type { CatalogProgram, VerifyReport } from "../lib/types";

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
  const gallery = useMemo(() => (program ? programGallery(program) : []), [program]);
  const cover = gallery[0];
  const language = program ? programLanguage(program) : undefined;
  const updated = program ? formatUpdated(program.updatedAt, i18n.language) : undefined;

  useEffect(() => {
    if (!program) {
      void api.getProgram(id).then(setRemote).catch(() => undefined);
    }
  }, [id, program]);

  useEffect(() => {
    if (!inst) return;
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
  const name = loc?.name ?? program.name;
  const summary = loc?.summary ?? program.summary;
  const repo = githubUrl(program);

  return (
    <div className="program-page">
      <header className={`program-hero${cover ? " has-cover" : ""}`}>
        {cover && <img className="program-cover" src={cover} alt="" />}
        <div className="program-hero-shade" aria-hidden />
        <div className="program-hero-copy">
          <p className="page-kicker">{program.sourceGithub}</p>
          <h1 className="page-title">{name}</h1>
          <p className="page-sub">{summary}</p>
          <div className="row">
            <span className={`pill ${program.official ? "ok" : "warn"}`}>
              {program.official ? t("detail.officialBadge") : t("detail.communityBadge")}
            </span>
            {language && <span className="pill">{language}</span>}
            {program.stars != null && (
              <span className="pill">
                <Star size={11} />
                {formatCount(program.stars)}
              </span>
            )}
            {program.forks != null && (
              <span className="pill">
                <GitFork size={11} />
                {formatCount(program.forks)}
              </span>
            )}
            {program.installed && <span className="pill">{t("detail.installed")}</span>}
          </div>
        </div>
      </header>

      <div className="program-layout">
        <div className="program-main">
          {gallery.length > 1 && <ShotCarousel images={gallery} label={t("detail.screenshots")} />}
          <section className="readme-card">
            <h2>{t("detail.readme")}</h2>
            {program.readme ? <MarkdownView source={program.readme} /> : <p className="page-sub">{t("detail.noReadme")}</p>}
          </section>
        </div>

        <aside className="program-aside">
          <div className="repo-card">
            <div className="repo-head">
              {program.ownerAvatar ? (
                <img src={program.ownerAvatar} alt="" className="repo-avatar" />
              ) : (
                <span className="repo-avatar fallback">{name.slice(0, 1)}</span>
              )}
              <div>
                <strong>{t("detail.repo")}</strong>
                <a href={repo} target="_blank" rel="noreferrer">
                  {program.sourceGithub}
                </a>
              </div>
            </div>
            <dl className="repo-meta">
              <div>
                <dt>{t("detail.version")}</dt>
                <dd>{program.version}</dd>
              </div>
              <div>
                <dt>{t("detail.license")}</dt>
                <dd>{program.license || "—"}</dd>
              </div>
              {language && (
                <div>
                  <dt>{t("detail.language")}</dt>
                  <dd>{language}</dd>
                </div>
              )}
              {program.stars != null && (
                <div>
                  <dt>{t("detail.stars")}</dt>
                  <dd>{formatCount(program.stars)}</dd>
                </div>
              )}
              {program.forks != null && (
                <div>
                  <dt>{t("detail.forks")}</dt>
                  <dd>{formatCount(program.forks)}</dd>
                </div>
              )}
              {updated && (
                <div>
                  <dt>{t("detail.updated")}</dt>
                  <dd>{updated}</dd>
                </div>
              )}
              {program.commitSha && (
                <div>
                  <dt>{t("detail.commit")}</dt>
                  <dd className="mono">{program.commitSha.slice(0, 8)}</dd>
                </div>
              )}
              {program.categories?.length > 0 && (
                <div>
                  <dt>{t("detail.category")}</dt>
                  <dd>{program.categories.join(", ")}</dd>
                </div>
              )}
            </dl>
            <PermissionChips permissions={program.permissions} />
            <div className="repo-actions">
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
            {progress && <p className="page-sub">{progress}</p>}
            {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
          </div>
        </aside>
      </div>

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
