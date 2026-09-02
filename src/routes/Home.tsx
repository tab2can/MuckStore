import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "../stores/useApp";
import { ProgramCard } from "../components/ProgramCard";
import { HomeCarousel } from "../components/HomeCarousel";
import { Segmented } from "../components/ui/Segmented";
import { FilterSelect } from "../components/ui/FilterSelect";
import {
  filterPrograms,
  mergeCatalog,
  sortPrograms,
  topPrograms,
  uniqueCategories,
  uniqueLanguages,
  uniqueLicenses,
  type OriginFilter,
  type SortKey,
} from "../lib/catalogBrowse";

export function Home() {
  const { t, i18n } = useTranslation();
  const official = useApp((s) => s.official);
  const community = useApp((s) => s.community);
  const discovered = useApp((s) => s.discovered);
  const updates = useApp((s) => s.updates);
  const pending = updates.filter((u) => u.available);

  const [sort, setSort] = useState<SortKey>("stars");
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");
  const [license, setLicense] = useState("");

  const catalog = useMemo(
    () => mergeCatalog(official, community, discovered),
    [official, community, discovered],
  );
  const locale = i18n.language;
  const topStars = useMemo(() => topPrograms(catalog, "stars", locale, 10), [catalog, locale]);
  const topForks = useMemo(() => topPrograms(catalog, "forks", locale, 10), [catalog, locale]);
  const languages = useMemo(() => uniqueLanguages(catalog), [catalog]);
  const categories = useMemo(() => uniqueCategories(catalog), [catalog]);
  const licenses = useMemo(() => uniqueLicenses(catalog), [catalog]);
  const listed = useMemo(
    () =>
      sortPrograms(
        filterPrograms(catalog, {
          language: language || undefined,
          category: category || undefined,
          license: license || undefined,
          origin,
          locale,
        }),
        sort,
        locale,
      ),
    [catalog, language, category, license, origin, sort, locale],
  );

  return (
    <div className="home">
      {pending.length > 0 && (
        <div className="home-banner">
          <span>
            {t("home.updates")}: {pending.length}
          </span>
          <Link className="btn sm" to="/updates">
            {t("nav.updates")}
          </Link>
        </div>
      )}
      <div className="spotlight-pair">
        <HomeCarousel
          kicker={t("home.spotlight")}
          title={t("home.topStars")}
          programs={topStars}
          metric="stars"
          locale={locale}
          empty={t("home.emptyCatalog")}
        />
        <HomeCarousel
          kicker={t("home.spotlight")}
          title={t("home.topForks")}
          programs={topForks}
          metric="forks"
          locale={locale}
          empty={t("home.emptyCatalog")}
        />
      </div>
      <section className="section">
        <div className="section-head">
          <h2>{t("home.allPrograms")}</h2>
          <span className="section-count">{listed.length}</span>
        </div>
        <div className="catalog-toolbar">
          <Segmented
            value={sort}
            onChange={setSort}
            options={[
              { id: "stars", label: t("home.sortStars") },
              { id: "forks", label: t("home.sortForks") },
              { id: "name", label: t("home.sortName") },
              { id: "updated", label: t("home.sortUpdated") },
            ]}
          />
          <Segmented
            value={origin}
            onChange={setOrigin}
            options={[
              { id: "all", label: t("home.originAll") },
              { id: "official", label: t("home.originOfficial") },
              { id: "community", label: t("home.originCommunity") },
            ]}
          />
          <FilterSelect
            label={t("home.filterLanguage")}
            placeholder={t("home.anyLanguage")}
            value={language}
            onChange={setLanguage}
            options={languages.map((lang) => ({ id: lang, label: lang }))}
          />
          <FilterSelect
            label={t("home.filterCategory")}
            placeholder={t("home.anyCategory")}
            value={category}
            onChange={setCategory}
            options={categories.map((item) => ({ id: item, label: item }))}
          />
          {licenses.length > 1 && (
            <FilterSelect
              label={t("home.filterLicense")}
              placeholder={t("home.anyLicense")}
              value={license}
              onChange={setLicense}
              options={licenses.map((item) => ({ id: item, label: item }))}
            />
          )}
        </div>
        {listed.length === 0 ? (
          <div className="empty">{t("home.emptyCatalog")}</div>
        ) : (
          <div className="grid">
            {listed.map((p) => (
              <ProgramCard key={p.id} program={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
