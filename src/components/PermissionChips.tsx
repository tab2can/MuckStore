import { useTranslation } from "react-i18next";
import { PERMISSION_META } from "../lib/permissions";

export function PermissionChips({ permissions }: { permissions: string[] }) {
  const { t } = useTranslation();
  if (!permissions.length) return null;
  return (
    <div className="row">
      {permissions.map((p) => (
        <span key={p} className={`pill ${PERMISSION_META[p]?.tone ?? "warn"}`}>
          {t(`permissions.${p}`, p)}
        </span>
      ))}
    </div>
  );
}
