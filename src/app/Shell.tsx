import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Compass,
  Home,
  LayoutGrid,
  Package,
  Palette,
  RefreshCw,
  Search,
  Settings,
} from "lucide-react";
import { useApp } from "../stores/useApp";
import { CommandPalette } from "./CommandPalette";
import { Titlebar } from "../components/Titlebar";
import { useEffect, useState } from "react";

const links = [
  { to: "/", key: "nav.home", icon: Home },
  { to: "/discover", key: "nav.discover", icon: Compass },
  { to: "/library", key: "nav.library", icon: LayoutGrid },
  { to: "/installed", key: "nav.installed", icon: Package },
  { to: "/updates", key: "nav.updates", icon: RefreshCw, badge: true },
  { to: "/themes", key: "nav.themes", icon: Palette },
  { to: "/settings", key: "nav.settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const settings = useApp((s) => s.settings);
  const pending = useApp((s) => s.updates.filter((u) => u.available).length);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
      }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="frame">
      <Titlebar />
      <div className={`shell ${settings?.sidebarPosition === "right" ? "sidebar-right" : ""}`}>
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">Muck</span>
            <span className="brand-rest">Store</span>
          </div>
          <nav className="nav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
                <l.icon size={16} strokeWidth={1.75} />
                <span>{t(l.key)}</span>
                {l.badge && pending > 0 && <em className="nav-count">{pending}</em>}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">{t("app.tagline")}</div>
        </aside>
        <div className="main">
          <header className="topbar">
            <label className="search">
              <Search size={16} />
              <input
                value={query}
                placeholder={t("nav.search")}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setPalette(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim()) {
                    navigate(`/discover?q=${encodeURIComponent(query.trim())}`);
                    setPalette(false);
                  }
                }}
              />
              <span className="kbd">Ctrl+K</span>
            </label>
          </header>
          <main className="content">
            <div className="content-inner">{children}</div>
          </main>
        </div>
        {palette && (
          <CommandPalette query={query} setQuery={setQuery} onClose={() => setPalette(false)} />
        )}
      </div>
    </div>
  );
}
