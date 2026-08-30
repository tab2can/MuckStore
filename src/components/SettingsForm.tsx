import type { SettingsSchema } from "../lib/types";
import { Switch } from "./ui/Switch";
import { Slider } from "./ui/Slider";
import { Segmented } from "./ui/Segmented";
import { SettingRow } from "./ui/SettingRow";

export function SettingsForm({
  schema,
  value,
  onChange,
}: {
  schema: SettingsSchema;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const props = schema.properties ?? {};
  return (
    <div className="settings-card" style={{ paddingTop: 4 }}>
      {Object.entries(props).map(([key, prop]) => {
        const widget = prop["x-muck-widget"] ?? infer(prop);
        const current = value[key] ?? prop.default ?? "";
        const set = (v: unknown) => onChange({ ...value, [key]: v });
        const title = prop.title ?? key;
        const description = prop.description;
        if (widget === "toggle") {
          return (
            <SettingRow key={key} title={title} description={description}>
              <Switch checked={Boolean(current)} onChange={set} label={title} />
            </SettingRow>
          );
        }
        if (widget === "slider") {
          const min = prop.minimum ?? 0;
          const max = prop.maximum ?? 100;
          const step = max <= 1 ? 0.01 : 1;
          return (
            <SettingRow key={key} title={title} description={description}>
              <Slider min={min} max={max} step={step} value={Number(current) || 0} onChange={set} />
            </SettingRow>
          );
        }
        if (widget === "select") {
          const opts = (prop.enum ?? []).map((opt) => ({ id: String(opt), label: String(opt) }));
          return (
            <SettingRow key={key} title={title} description={description}>
              {opts.length <= 4 ? (
                <Segmented value={String(current)} onChange={set} options={opts} />
              ) : (
                <select value={String(current)} onChange={(e) => set(e.target.value)}>
                  {opts.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </SettingRow>
          );
        }
        return (
          <div key={key} className="field" style={{ padding: "12px 0" }}>
            <span>{title}</span>
            {widget === "password" && (
              <input type="password" value={String(current)} onChange={(e) => set(e.target.value)} />
            )}
            {widget === "color" && (
              <input type="color" value={String(current) || "#d4a056"} onChange={(e) => set(e.target.value)} />
            )}
            {widget === "number" && (
              <input
                type="number"
                min={prop.minimum}
                max={prop.maximum}
                value={Number(current) || 0}
                onChange={(e) => set(Number(e.target.value))}
              />
            )}
            {widget === "list" && (
              <input
                value={Array.isArray(current) ? current.join(", ") : String(current)}
                onChange={(e) =>
                  set(
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
              />
            )}
            {(widget === "text" || widget === "hotkey" || widget === "path") && (
              <input value={String(current)} onChange={(e) => set(e.target.value)} />
            )}
            {description && <small style={{ color: "var(--text-muted)" }}>{description}</small>}
          </div>
        );
      })}
    </div>
  );
}

function infer(prop: { type?: string; enum?: unknown[] }): string {
  if (prop.enum) return "select";
  if (prop.type === "boolean") return "toggle";
  if (prop.type === "number" || prop.type === "integer") return "number";
  if (prop.type === "array") return "list";
  return "text";
}
