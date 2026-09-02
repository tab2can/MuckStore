import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GitFork, Star } from "lucide-react";
import type { CatalogProgram } from "../lib/types";
import { formatCount, programLanguage } from "../lib/catalogBrowse";

export function ProgramCard({ program }: { program: CatalogProgram }) {
  const { t, i18n } = useTranslation();
  const loc = program.manifest?.i18n?.[i18n.language];
  const language = programLanguage(program);
  return (
    <Link className="card" to={`/program/${encodeURIComponent(program.id)}`}>
      <div className="row">
        <span className={`pill ${program.official ? "ok" : "warn"}`}>
          {program.official ? t("detail.officialBadge") : t("detail.communityBadge")}
        </span>
        {language && <span className="pill">{language}</span>}
        {program.installed && <span className="pill">{t("detail.installed")}</span>}
      </div>
      <h3>{loc?.name ?? program.name}</h3>
      <p>{loc?.summary ?? program.summary}</p>
      <div className="row">
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
      </div>
    </Link>
  );
}
