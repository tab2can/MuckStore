import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApp } from "../stores/useApp";
import { ProgramCard } from "../components/ProgramCard";

export function Home() {
  const { t } = useTranslation();
  const official = useApp((s) => s.official);
  const installed = useApp((s) => s.installed);
  const updates = useApp((s) => s.updates);
  const featured = official.filter((p) => p.featured);
  const pending = updates.filter((u) => u.available);

  return (
    <div>
      <div className="hero">
        <div className="hero-copy">
          <p className="page-kicker">{t("app.name")}</p>
          <h1>{t("home.welcome")}</h1>
          <p className="page-sub">{t("home.welcomeBody")}</p>
          <div className="row">
            <Link className="btn primary" to="/library">
              {t("nav.library")}
            </Link>
            <Link className="btn" to="/discover">
              {t("nav.discover")}
            </Link>
          </div>
        </div>
        <div className="panel">
          <h2 style={{ marginTop: 0, fontSize: 15, letterSpacing: "-0.02em" }}>{t("home.updates")}</h2>
          {pending.length === 0 ? (
            <p className="page-sub" style={{ margin: 0 }}>
              {t("updates.none")}
            </p>
          ) : (
            pending.map((u) => (
              <p key={u.id}>
                {u.id} → {u.available}
              </p>
            ))
          )}
          <Link className="btn sm" to="/updates" style={{ marginTop: 12 }}>
            {t("nav.updates")}
          </Link>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <b>{official.length}</b>
          <span>{t("home.statOfficial")}</span>
        </div>
        <div className="stat">
          <b>{installed.length}</b>
          <span>{t("home.statInstalled")}</span>
        </div>
        <div className="stat">
          <b>{pending.length}</b>
          <span>{t("home.statUpdates")}</span>
        </div>
      </div>
      <section className="section">
        <h2>{t("home.featured")}</h2>
        <div className="grid">
          {(featured.length ? featured : official).map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
        </div>
      </section>
      <section className="section">
        <h2>{t("home.installed")}</h2>
        {installed.length === 0 ? (
          <div className="empty">{t("home.emptyInstalled")}</div>
        ) : (
          <div className="grid">
            {installed.map((p) => (
              <article key={p.id} className="card">
                <h3>{p.manifest.name}</h3>
                <p>{p.manifest.summary}</p>
                <Link className="btn" to={`/program/${encodeURIComponent(p.id)}`}>
                  {p.version}
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
