import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

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
  const items = useMemo(
    () =>
      [
        { label: t("nav.home"), to: "/" },
        { label: t("nav.discover"), to: "/discover" },
        { label: t("nav.library"), to: "/library" },
        { label: t("nav.installed"), to: "/installed" },
        { label: t("nav.updates"), to: "/updates" },
        { label: t("nav.themes"), to: "/themes" },
        { label: t("nav.settings"), to: "/settings" },
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
            key={item.to}
            type="button"
            onClick={() => {
              navigate(item.to);
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
