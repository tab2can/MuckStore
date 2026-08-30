import { useTranslation } from "react-i18next";
import { useApp } from "../stores/useApp";
import { ProgramCard } from "../components/ProgramCard";

export function Library() {
  const { t } = useTranslation();
  const official = useApp((s) => s.official);
  return (
    <div>
      <p className="page-kicker">{t("library.official")}</p>
      <h1 className="page-title">{t("library.title")}</h1>
      <p className="page-sub">{t("library.subtitle")}</p>
      <div className="grid">
        {official.map((p) => (
          <ProgramCard key={p.id} program={p} />
        ))}
      </div>
    </div>
  );
}
