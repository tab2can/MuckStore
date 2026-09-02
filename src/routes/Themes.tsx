import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { previewTokens, BUILTIN_THEMES } from "../lib/themes";
import { api, isTauri } from "../lib/api";
import { useApp } from "../stores/useApp";
import { ThemeChromePreview } from "../components/ThemeChromePreview";
import type { ThemePack } from "../lib/types";

export function Themes() {
  const { t } = useTranslation();
  const settings = useApp((s) => s.settings);
  const themes = useApp((s) => s.themes);
  const patch = useApp((s) => s.patchSettings);
  const hydrate = useApp((s) => s.hydrate);
  const openStudio = useApp((s) => s.openStudio);

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

  function pick(id: string) {
    if (settings?.themeId === id) return;
    void patch({ themeId: id });
  }

  return (
    <div>
      <div className="library-head">
        <h1 className="page-title">{t("themes.title")}</h1>
        <button className="btn primary" type="button" onClick={() => openStudio()}>
          {t("themes.create")}
        </button>
      </div>
      <section className="section">
        <h2>{t("themes.builtin")}</h2>
        <div className="theme-grid">
          <ThemeCard
            name={t("themes.system")}
            hint={t("themes.followWindows")}
            title={t("themes.systemHint")}
            active={settings?.themeId === "system"}
            tokens={previewTokens("system")}
            onPick={() => pick("system")}
          />
          {BUILTIN_THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              name={theme.name}
              hint={t("themes.builtinHint")}
              active={settings?.themeId === theme.id}
              tokens={previewTokens(theme.id)}
              onPick={() => pick(theme.id)}
            />
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
          <div className="theme-grid">
            {themes.map((theme) => (
              <ThemeCard
                key={theme.id}
                name={theme.name}
                hint={theme.author && theme.author !== "custom" ? theme.author : t("themes.yours")}
                active={settings?.themeId === theme.id}
                tokens={previewTokens(theme.id, theme.tokens)}
                pack={theme}
                onPick={() => pick(theme.id)}
                onEdit={() => openStudio(theme)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ThemeCard({
  name,
  hint,
  title,
  tokens,
  active,
  pack,
  onPick,
  onEdit,
}: {
  name: string;
  hint: string;
  title?: string;
  tokens: Record<string, string>;
  active?: boolean;
  pack?: ThemePack;
  onPick: () => void;
  onEdit?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="theme-card-wrap">
      <button
        type="button"
        className={`theme-card${active ? " on" : ""}`}
        onClick={onPick}
        aria-pressed={active}
        title={title ?? name}
      >
        <ThemeChromePreview tokens={tokens} />
        <span className="theme-card-meta">
          <strong>{name}</strong>
          <small>{hint}</small>
        </span>
      </button>
      {pack && onEdit && (
        <button type="button" className="btn sm ghost theme-edit" aria-label={t("themes.edit")} onClick={onEdit}>
          <Pencil size={14} />
        </button>
      )}
    </div>
  );
}
