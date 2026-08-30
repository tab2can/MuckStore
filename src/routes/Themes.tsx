import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { BUILTIN_THEMES } from "../lib/themes";
import { api, isTauri } from "../lib/api";
import { useApp } from "../stores/useApp";

export function Themes() {
  const { t } = useTranslation();
  const settings = useApp((s) => s.settings);
  const themes = useApp((s) => s.themes);
  const patch = useApp((s) => s.patchSettings);
  const hydrate = useApp((s) => s.hydrate);

  async function importJson() {
    if (!isTauri) return;
    const selected = await open({
      multiple: false,
      filters: [{ name: "Theme", extensions: ["json"] }],
    });
    if (typeof selected === "string") {
      await api.importTheme(selected);
      await hydrate();
    }
  }

  return (
    <div>
      <p className="page-kicker">{t("nav.themes")}</p>
      <h1 className="page-title">{t("themes.title")}</h1>
      <p className="page-sub">{t("themes.subtitle")}</p>
      <section className="section">
        <h2>{t("themes.builtin")}</h2>
        <div className="grid">
          {BUILTIN_THEMES.map((theme) => (
            <article key={theme.id} className="card">
              <div className="theme-swatch" aria-hidden>
                <span style={{ background: theme.tokens.bg }} />
                <span style={{ background: theme.tokens.surface }} />
                <span style={{ background: theme.tokens.accent }} />
                <span style={{ background: theme.tokens.text }} />
              </div>
              <h3>{theme.name}</h3>
              <p>{theme.id}</p>
              <button
                className={`btn ${settings?.themeId === theme.id ? "primary" : ""}`}
                type="button"
                onClick={() => void patch({ themeId: theme.id })}
              >
                {settings?.themeId === theme.id ? t("themes.active") : t("themes.apply")}
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="row">
          <h2 className="grow">{t("themes.imported")}</h2>
          <button className="btn" type="button" onClick={() => void importJson()}>
            {t("themes.import")}
          </button>
        </div>
        {themes.length === 0 ? (
          <div className="empty">{t("themes.emptyImported")}</div>
        ) : (
          <div className="grid">
            {themes.map((theme) => (
              <article key={theme.id} className="card">
                <h3>{theme.name}</h3>
                <p>{theme.author ?? theme.id}</p>
                <button className="btn" type="button" onClick={() => void patch({ themeId: theme.id })}>
                  {t("themes.apply")}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
