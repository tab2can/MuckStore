import { useTranslation } from "react-i18next";
import { PermissionChips } from "./PermissionChips";
import type { VerifyReport } from "../lib/types";

export function TrustDialog({
  name,
  repo,
  permissions,
  report,
  onCancel,
  onAccept,
}: {
  name: string;
  repo: string;
  permissions: string[];
  report: VerifyReport | null;
  onCancel: () => void;
  onAccept: () => void;
}) {
  const { t } = useTranslation();
  const blocked = report?.verdict === "blocked";
  const verified = report?.verdict === "verified";
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <h2>{verified ? t("trust.verifiedTitle") : t("trust.title")}</h2>
        <p>{verified ? t("trust.verifiedBody") : t("trust.body")}</p>
        <p>
          <strong>{name}</strong>
          <br />
          {t("trust.repo")}: {repo}
          {report?.commitSha && (
            <>
              <br />
              {t("trust.commit")}: {report.commitSha.slice(0, 12)}
            </>
          )}
        </p>
        {report && (
          <ul className="checks">
            {report.checks.map((c, i) => (
              <li key={`${c.id}-${i}`} className={`check ${c.status}`}>
                <span className="check-mark">{c.status === "pass" ? "OK" : c.status === "fail" ? "X" : "!"}</span>
                <span>
                  <strong>{t(`verify.${c.id}`, c.id)}</strong>
                  <br />
                  {c.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
        <PermissionChips permissions={permissions} />
        <p>{t("trust.av")}</p>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn ghost" type="button" onClick={onCancel}>
            {t("trust.cancel")}
          </button>
          <span className="grow" />
          <button
            className={`btn ${blocked ? "danger" : "primary"}`}
            type="button"
            disabled={blocked}
            onClick={onAccept}
          >
            {blocked ? t("trust.blocked") : verified ? t("trust.installVerified") : t("trust.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
