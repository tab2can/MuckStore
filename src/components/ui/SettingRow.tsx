export function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-copy">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}
