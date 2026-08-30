import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useApp } from "../stores/useApp";
import { ProgramCard } from "../components/ProgramCard";
import type { CatalogProgram } from "../lib/types";

export function Discover() {
  const { t } = useTranslation();
  const community = useApp((s) => s.community);
  const remember = useApp((s) => s.remember);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [url, setUrl] = useState("");
  const [results, setResults] = useState<CatalogProgram[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initial = params.get("q") ?? "";
    if (initial) void runSearch(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(query: string) {
    setLoading(true);
    setError(null);
    try {
      const found = await api.searchGithub(query);
      found.forEach(remember);
      setResults(found);
      setParams(query ? { q: query } : {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function addUrl() {
    const github = url.replace("https://github.com/", "").replace(/\/$/, "");
    if (!github.includes("/")) return;
    setLoading(true);
    try {
      const program = await api.fetchGithub(github);
      remember(program);
      setResults([program, ...results.filter((r) => r.id !== program.id)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="page-kicker">{t("nav.discover")}</p>
      <h1 className="page-title">{t("discover.title")}</h1>
      <p className="page-sub">{t("discover.subtitle")}</p>
      <form
        className="row"
        style={{ marginBottom: 20 }}
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(q);
        }}
      >
        <label className="search" style={{ flex: 1 }}>
          <input value={q} placeholder={t("discover.placeholder")} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button className="btn primary" type="submit">
          {t("nav.discover")}
        </button>
      </form>
      <div className="row" style={{ marginBottom: 28 }}>
        <input
          className="search"
          style={{ flex: 1, borderRadius: 8 }}
          value={url}
          placeholder={t("discover.addUrlHint")}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="btn" type="button" onClick={() => void addUrl()}>
          {t("discover.addUrl")}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {loading && <p>{t("common.loading")}</p>}
      {results.length > 0 && (
        <section className="section">
          <div className="grid">
            {results.map((p) => (
              <ProgramCard key={p.id} program={p} />
            ))}
          </div>
        </section>
      )}
      {!loading && results.length === 0 && <div className="empty">{t("discover.empty")}</div>}
      <section className="section">
        <h2>{t("discover.community")}</h2>
        <div className="grid">
          {community.map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
