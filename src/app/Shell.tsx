import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, LayoutGrid, Palette, Settings, X } from "lucide-react";
import { useApp, type OverlayId } from "../stores/useApp";
import { CommandPalette } from "./CommandPalette";
import { Titlebar } from "../components/Titlebar";
import { Themes } from "../routes/Themes";
import { SettingsPage } from "../routes/Settings";
import { ThemeStudio } from "../components/ThemeStudio";
import { ProgramSettings } from "../components/ProgramSettings";
import { useEffect, useState } from "react";
import { useNavWidth } from "../lib/navWidth";

const topLinks = [
  { to: "/", key: "nav.home", icon: Home },
  { to: "/library", key: "nav.library", icon: LayoutGrid },
];

const overlayLinks: { id: OverlayId; key: string; icon: typeof Palette }[] = [
  { id: "themes", key: "nav.themes", icon: Palette },
  { id: "settings", key: "nav.settings", icon: Settings },
];

const WIDTH_KEY = "muck-sidebar-width";

export function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const settings = useApp((s) => s.settings);
  const overlay = useApp((s) => s.overlay);
  const studio = useApp((s) => s.studio);
  const notice = useApp((s) => s.notice);
  const setOverlay = useApp((s) => s.setOverlay);
  const closeStudio = useApp((s) => s.closeStudio);
  const [query, setQuery] = useState("");
  const [palette, setPalette] = useState(false);
  const { width, collapsed, dragging, onResizePointerDown } = useNavWidth(WIDTH_KEY);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setPalette(true);
      }
      if (e.key === "Escape") {
        if (studio) {
          closeStudio();
          setOverlay("themes");
          return;
        }
        if (overlay) {
          setOverlay(null);
          return;
        }
        setPalette(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay, studio, setOverlay, closeStudio]);

  const sidebarOnRight = settings?.sidebarPosition === "right";

  return (
    <div className="frame">
      <Titlebar />
      <div
        className={`shell${sidebarOnRight ? " sidebar-right" : ""}${collapsed ? " sidebar-collapsed" : ""}${dragging ? " sidebar-resizing" : ""}`}
        style={{ ["--sidebar" as string]: `${width}px` }}
      >
        <aside className="sidebar">
          <nav className="nav nav-top">
            {topLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) => (isActive && !overlay ? "active" : "")}
                title={t(l.key)}
                onClick={() => setOverlay(null)}
              >
                <l.icon size={16} strokeWidth={1.75} />
                <span>{t(l.key)}</span>
              </NavLink>
            ))}
          </nav>
          <nav className="nav nav-bottom">
            {overlayLinks.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`nav-link${overlay === l.id || (Boolean(studio) && l.id === "themes") ? " active" : ""}`}
                title={t(l.key)}
                onClick={() => {
                  if (overlay === l.id) {
                    setOverlay(null);
                    return;
                  }
                  if (l.id === "settings") useApp.setState({ overlay: "settings", settingsSection: "appearance", studio: null });
                  else setOverlay(l.id);
                }}
              >
                <l.icon size={16} strokeWidth={1.75} />
                <span>{t(l.key)}</span>
              </button>
            ))}
          </nav>
          <div
            className="sidebar-resizer"
            onPointerDown={(e) => onResizePointerDown(e, ".sidebar", sidebarOnRight ? "left" : "right")}
            role="separator"
            aria-orientation="vertical"
            aria-label={t("nav.resizeSidebar")}
          />
        </aside>
        <div className="main">
          <main className="content">
            <div className="content-inner">{children}</div>
          </main>
        </div>
        {palette && (
          <CommandPalette query={query} setQuery={setQuery} onClose={() => setPalette(false)} />
        )}
        {studio && (
          <div className="sheet-backdrop studio-back">
            <div className="sheet studio-sheet" role="dialog" aria-modal="true">
              <button
                type="button"
                className="sheet-close"
                aria-label={t("common.close")}
                onClick={() => {
                  closeStudio();
                  setOverlay("themes");
                }}
              >
                <X size={16} />
              </button>
              <ThemeStudio />
            </div>
          </div>
        )}
        {overlay && !studio && (
          <div className="sheet-backdrop" onClick={() => setOverlay(null)}>
            <div
              className={`sheet${overlay === "settings" || overlay === "program" ? " settings-sheet" : ""}`}
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="sheet-close"
                aria-label={t("common.close")}
                onClick={() => setOverlay(null)}
              >
                <X size={16} />
              </button>
              {overlay === "themes" ? (
                <Themes />
              ) : overlay === "program" ? (
                <ProgramSettings />
              ) : (
                <SettingsPage />
              )}
            </div>
          </div>
        )}
      </div>
      {notice && (
        <p className="app-toast" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
