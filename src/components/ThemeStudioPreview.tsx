import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Home, LayoutGrid, MoreHorizontal, Palette, Settings } from "lucide-react";
import { fieldById } from "../lib/themeStudio";
import { tokensToStyle } from "../lib/themes";

export function ThemeStudioPreview({
  tokens,
  focus,
  onPick,
}: {
  tokens: Record<string, string>;
  focus: string;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const stage = useRef<HTMLDivElement>(null);
  const field = fieldById(focus);

  useEffect(() => {
    const node =
      stage.current?.querySelector(`[data-token="${focus}"]`) ??
      stage.current?.querySelector(`[data-slot="${field.group}"]`);
    node?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [focus, field.group]);

  const style = tokensToStyle(tokens) as CSSProperties;

  function pick(id: string) {
    return (e: MouseEvent) => {
      e.stopPropagation();
      onPick(id);
    };
  }

  const tokenOn = (id: string) => (focus === id ? " is-spot" : "");

  return (
    <div className="studio-preview" style={style} ref={stage}>
      <p className="studio-scene-label">
        {t("themes.studioFocus", { name: t(`themes.token.${focus}`) })}
      </p>
      <div className="studio-stage">
        <div className={`studio-mini${tokenOn("bg")}`} data-token="bg" data-slot="window" onClick={pick("bg")}>
          <header
            className={`studio-mini-bar${tokenOn("titlebarBg")}${focus === "titlebarBorder" ? " is-spot" : ""}`}
            data-token="titlebarBg"
            data-slot="titlebar"
            onClick={pick("titlebarBg")}
          >
            <span className="studio-mini-brand">
              <strong className={tokenOn("brand")} data-token="brand" onClick={pick("brand")}>
                MUCK
              </strong>{" "}
              <span className={tokenOn("titlebarText")} data-token="titlebarText" onClick={pick("titlebarText")}>
                STORE
              </span>
            </span>
            <span className="studio-mini-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          </header>
          <div className="studio-mini-body">
            <aside
              className={`studio-mini-side${tokenOn("sidebarBg")}${focus === "sidebarBorder" ? " is-spot" : ""}`}
              data-token="sidebarBg"
              data-slot="sidebar"
              onClick={pick("sidebarBg")}
            >
              <span
                className={`studio-mini-nav on${tokenOn("navActiveBg")}${focus === "navActiveText" || focus === "navActiveBar" ? " is-spot" : ""}`}
                data-token="navActiveBg"
                data-slot="nav"
                onClick={pick("navActiveBg")}
              >
                <Home size={14} strokeWidth={1.75} />
                {t("nav.home")}
              </span>
              <span
                className={`studio-mini-nav${tokenOn("navText")}`}
                data-token="navText"
                data-slot="nav"
                onClick={pick("navText")}
              >
                <LayoutGrid size={14} strokeWidth={1.75} />
                {t("nav.library")}
              </span>
              <span
                className={`studio-mini-nav bottom${focus === "navHoverBg" || focus === "navHoverText" ? " hover is-spot" : ""}`}
                data-token="navHoverBg"
                data-slot="nav"
                onClick={pick("navHoverBg")}
              >
                <Palette size={14} strokeWidth={1.75} />
                {t("nav.themes")}
              </span>
              <span className="studio-mini-nav" data-slot="nav" onClick={pick("navText")}>
                <Settings size={14} strokeWidth={1.75} />
                {t("nav.settings")}
              </span>
            </aside>
            <div className="studio-mini-main">
              <p
                className={`page-kicker${tokenOn("kicker")}`}
                data-token="kicker"
                data-slot="type"
                onClick={pick("kicker")}
              >
                {t("nav.home")}
              </p>
              <h2
                className={`studio-mini-title${tokenOn("text")}`}
                data-token="text"
                data-slot="type"
                onClick={pick("text")}
              >
                {t("home.allPrograms")}
              </h2>
              <p
                className={`studio-mini-muted${tokenOn("textMuted")}`}
                data-token="textMuted"
                data-slot="type"
                onClick={pick("textMuted")}
              >
                {t("themes.studioPickHint")}
              </p>
              <div className="studio-mini-cards">
                <article
                  className={`card${tokenOn("surface")}${focus === "cardBorder" || focus === "radius" ? " is-spot" : ""}`}
                  data-token="surface"
                  data-slot="cards"
                  onClick={pick("surface")}
                >
                  <div className="row">
                    <span className={`pill warn${tokenOn("warning")}`} data-token="warning" onClick={pick("warning")}>
                      {t("detail.communityBadge")}
                    </span>
                  </div>
                  <h3 data-slot="type" onClick={pick("text")}>
                    Copper Term
                  </h3>
                  <p data-slot="type" onClick={pick("textMuted")}>
                    {t("themes.studioCardHint")}
                  </p>
                </article>
                <article
                  className={`card hovered${tokenOn("surfaceHover")}`}
                  data-token="surfaceHover"
                  data-slot="cards"
                  onClick={pick("surfaceHover")}
                >
                  <div className="row">
                    <span className={`pill ok${tokenOn("ok")}`} data-token="ok" onClick={pick("ok")}>
                      {t("detail.officialBadge")}
                    </span>
                  </div>
                  <h3>Quick Notes</h3>
                  <p>{t("themes.studioCardHint")}</p>
                </article>
              </div>
              <article
                className={`studio-mini-row${tokenOn("rowBg")}${focus === "rowBorder" ? " is-spot" : ""}`}
                data-token="rowBg"
                data-slot="rows"
                onClick={pick("rowBg")}
              >
                <span className="library-icon fallback">C</span>
                <span className="library-name">Copper Term</span>
                <span className="library-cell">1.0.0</span>
                <div className="library-actions">
                  <button
                    className={`btn sm primary${tokenOn("accent")}${focus === "accentText" ? " is-spot" : ""}`}
                    type="button"
                    data-token="accent"
                    data-slot="buttons"
                    onClick={pick("accent")}
                  >
                    {t("installed.run")}
                  </button>
                  <button className="btn sm ghost" type="button" onClick={pick("buttonBg")}>
                    <MoreHorizontal size={14} />
                  </button>
                </div>
              </article>
              <div className="studio-mini-buttons">
                <div className="row">
                  <button
                    className={`btn primary${tokenOn("accent")}`}
                    type="button"
                    data-token="accent"
                    data-slot="buttons"
                    onClick={pick("accent")}
                  >
                    {t("installed.run")}
                  </button>
                  <button
                    className={`btn${tokenOn("buttonBg")}${focus === "buttonText" || focus === "buttonBorder" ? " is-spot" : ""}`}
                    type="button"
                    data-token="buttonBg"
                    data-slot="buttons"
                    onClick={pick("buttonBg")}
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    className={`btn danger${tokenOn("danger")}`}
                    type="button"
                    data-token="danger"
                    data-slot="buttons"
                    onClick={pick("danger")}
                  >
                    {t("installed.uninstall")}
                  </button>
                </div>
                <label
                  className={`studio-mini-input${tokenOn("inputBg")}${focus === "inputBorder" ? " is-spot" : ""}`}
                  data-token="inputBg"
                  data-slot="panels"
                  onClick={pick("inputBg")}
                >
                  <span>{t("themes.token.inputBg")}</span>
                  <input readOnly tabIndex={-1} value={t("themes.studioInputSample")} onClick={pick("inputBg")} />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
