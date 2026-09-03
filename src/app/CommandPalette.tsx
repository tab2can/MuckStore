import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApp, type OverlayId } from "../stores/useApp";

export function CommandPalette({
  query,
  setQuery,
  onClose,
}: {
  query: string;
  setQuery: (v: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setOverlay = useApp((s) => s.setOverlay);
  const openUpdates = useApp((s) => s.openUpdates);
  const items = useMemo(
    () =>
      [
        { label: t("nav.home"), to: "/" as const },
        { label: t("nav.discover"), to: "/discover" as const },
        { label: t("nav.library"), to: "/library" as const },
        { label: t("nav.updates"), updates: true as const },
        { label: t("nav.themes"), overlay: "themes" as OverlayId },
        { label: t("nav.settings"), overlay: "settings" as OverlayId },
      ].filter((i) => i.label.toLowerCase().includes(query.toLowerCase())),
    [query, t],
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          placeholder={t("nav.search")}
          onChange={(e) => setQuery(e.target.value)}
        />
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              if ("updates" in item && item.updates) {
                openUpdates();
              } else if ("overlay" in item && item.overlay) {
                if (item.overlay === "settings") {
                  useApp.setState({ overlay: "settings", settingsSection: "appearance", studio: null });
                } else {
                  setOverlay(item.overlay);
                }
              } else if ("to" in item && item.to) {
                setOverlay(null);
                navigate(item.to);
              }
              onClose();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
