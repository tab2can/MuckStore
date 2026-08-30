import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { CatalogProgram } from "../lib/types";

export function ProgramCard({ program }: { program: CatalogProgram }) {
  const { t, i18n } = useTranslation();
  const loc = program.manifest?.i18n?.[i18n.language];
  return (
    <article className="card">
      <div className="row">
        <span className={`pill ${program.official ? "ok" : "warn"}`}>
          {program.official ? t("detail.officialBadge") : t("detail.communityBadge")}
        </span>
        {program.installed && <span className="pill">{t("detail.installed")}</span>}
      </div>
      <h3>{loc?.name ?? program.name}</h3>
      <p>{loc?.summary ?? program.summary}</p>
      <div className="row">
        <span className="pill">{program.version}</span>
        <span className="grow" />
        <Link className="btn primary sm" to={`/program/${encodeURIComponent(program.id)}`}>
          {program.installed ? t("installed.settings") : t("detail.install")}
        </Link>
      </div>
    </article>
  );
}
