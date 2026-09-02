import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useApp } from "../stores/useApp";
import { Slider } from "./ui/Slider";
import { ThemeStudioPreview } from "./ThemeStudioPreview";
import {
  STUDIO_FONTS,
  TOKEN_FIELDS,
  TOKEN_GROUPS,
  composeFill,
  composeColor,
  fieldById,
  firstFieldInGroup,
  matchStudioFont,
  parseColor,
  parseFill,
  parsePx,
  shiftHex,
  toHex6,
  tokensForSave,
  tryHexColor,
  type FillMode,
  type TokenField,
} from "../lib/themeStudio";
import { slugThemeId } from "../lib/themes";

export function ThemeStudio() {
  const { t } = useTranslation();
  const studio = useApp((s) => s.studio);
  const themes = useApp((s) => s.themes);
  const closeStudio = useApp((s) => s.closeStudio);
  const hydrate = useApp((s) => s.hydrate);
  const patch = useApp((s) => s.patchSettings);
  const setOverlay = useApp((s) => s.setOverlay);
  const settings = useApp((s) => s.settings);

  const editing = studio?.mode === "edit" ? studio.pack : null;
  const [name, setName] = useState(editing?.name ?? t("themes.studioUntitled"));
  const [tokens, setTokens] = useState<Record<string, string>>(() => ({ ...(studio?.tokens ?? {}) }));
  const [focus, setFocus] = useState("bg");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeField = useRef<HTMLElement | null>(null);

  const field = fieldById(focus);
  const group = field.group;

  const groupFields = useMemo(
    () => TOKEN_FIELDS.filter((item) => item.group === group),
    [group],
  );

  useEffect(() => {
    activeField.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focus]);

  if (!studio) return null;

  function patchTokens(next: Record<string, string>) {
    setTokens((prev) => ({ ...prev, ...next }));
  }

  function jumpGroup(next: string) {
    if (group === next) return;
    setFocus(firstFieldInGroup(next).id);
  }

  function stepField(delta: number) {
    const i = TOKEN_FIELDS.findIndex((item) => item.id === focus);
    const next = TOKEN_FIELDS[(i + delta + TOKEN_FIELDS.length) % TOKEN_FIELDS.length];
    setFocus(next.id);
  }

  async function save() {
    const trimmed = name.trim() || t("themes.studioUntitled");
    let id = editing?.id ?? slugThemeId(trimmed);
    if (!editing) {
      const taken = new Set(["system", "midnight", "daylight", "high-contrast", "amoled", ...themes.map((th) => th.id)]);
      let n = 2;
      const base = id;
      while (taken.has(id)) {
        id = `${base}-${n}`;
        n += 1;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const pack = await api.saveTheme({
        id,
        name: trimmed,
        author: editing?.author ?? "custom",
        tokens: tokensForSave(tokens),
      });
      await hydrate();
      await patch({ themeId: pack.id });
      closeStudio();
      setOverlay("themes");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!window.confirm(t("themes.deleteConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      if (settings?.themeId === editing.id) {
        await patch({ themeId: "system" });
      }
      await api.deleteTheme(editing.id);
      await hydrate();
      closeStudio();
      setOverlay("themes");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio">
      <header className="studio-head">
        <div>
          <p className="page-kicker">{t("themes.studioKicker")}</p>
          <input
            className="studio-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={t("themes.studioName")}
          />
        </div>
        <div className="row">
          {editing && (
            <button className="btn danger" type="button" disabled={busy} onClick={() => void remove()}>
              {t("themes.delete")}
            </button>
          )}
          <button
            className="btn"
            type="button"
            onClick={() => {
              closeStudio();
              setOverlay("themes");
            }}
          >
            {t("common.cancel")}
          </button>
          <button className="btn primary" type="button" disabled={busy} onClick={() => void save()}>
            {busy ? t("common.loading") : t("themes.studioSave")}
          </button>
        </div>
      </header>
      {error && <p className="studio-error">{error}</p>}
      <div className="studio-layout">
        <div className="studio-editor">
          <div className="studio-regions" role="tablist" aria-label={t("themes.studioRegions")}>
            {TOKEN_GROUPS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={group === item}
                className={`studio-region${group === item ? " on" : ""}`}
                onClick={() => jumpGroup(item)}
              >
                {t(`themes.group.${item}`)}
              </button>
            ))}
          </div>
          <div
            className="studio-controls"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                stepField(1);
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                stepField(-1);
              }
            }}
          >
            <section className="studio-group">
              <h2>{t(`themes.group.${group}`)}</h2>
              <p className="studio-group-hint">{t(`themes.groupHint.${group}`)}</p>
              {groupFields.map((item) => {
                const stacked = item.kind === "paint" || item.kind === "color";
                const props = {
                  className: `studio-field${stacked ? " stacked" : ""}${focus === item.id ? " on" : ""}`,
                  onPointerDown: () => setFocus(item.id),
                  ref: (node: HTMLElement | null) => {
                    if (focus === item.id) activeField.current = node;
                  },
                };
                const body = (
                  <>
                    <span>
                      {t(`themes.token.${item.id}`)}
                      <small>{t(`themes.tokenHint.${item.id}`)}</small>
                    </span>
                    <FieldControl field={item} value={tokens[item.id] ?? ""} tokens={tokens} onPatch={patchTokens} />
                  </>
                );
                return stacked ? (
                  <div key={item.id} {...props}>
                    {body}
                  </div>
                ) : (
                  <label key={item.id} {...props}>
                    {body}
                  </label>
                );
              })}
            </section>
          </div>
        </div>
        <div className="studio-stage-wrap">
          <ThemeStudioPreview tokens={tokens} focus={focus} onPick={setFocus} />
        </div>
      </div>
    </div>
  );
}

function FieldControl({
  field,
  value,
  tokens,
  onPatch,
}: {
  field: TokenField;
  value: string;
  tokens: Record<string, string>;
  onPatch: (next: Record<string, string>) => void;
}) {
  if (field.kind === "paint" && field.fillKey) {
    return <PaintControl field={field} tokens={tokens} onPatch={onPatch} />;
  }
  if (field.kind === "color" || field.kind === "paint") {
    return <ColorField value={value} onChange={(next) => onPatch({ [field.id]: next })} />;
  }
  if (field.kind === "font") {
    const current = matchStudioFont(value);
    return (
      <select value={current} onChange={(e) => onPatch({ [field.id]: e.target.value })}>
        {STUDIO_FONTS.map((font) => (
          <option key={font.label} value={font.id}>
            {font.label}
          </option>
        ))}
      </select>
    );
  }
  const min = field.kind === "blur" ? 0 : 2;
  const max = field.kind === "blur" ? 32 : 28;
  const fallback = field.kind === "blur" ? 16 : field.id === "radiusSm" ? 8 : 12;
  const n = parsePx(value, fallback);
  return (
    <Slider
      min={min}
      max={max}
      value={n}
      onChange={(next) => onPatch({ [field.id]: `${next}px` })}
      format={(v) => `${v}px`}
    />
  );
}

function PaintControl({
  field,
  tokens,
  onPatch,
}: {
  field: TokenField;
  tokens: Record<string, string>;
  onPatch: (next: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const fillKey = field.fillKey!;
  const parsed = parseFill(tokens[fillKey], tokens[field.id] ?? "");

  function apply(next: typeof parsed) {
    onPatch({ [field.id]: next.from, [fillKey]: composeFill(next) });
  }

  function setMode(mode: FillMode) {
    if (mode === parsed.mode) return;
    const to =
      mode === "solid"
        ? parsed.from
        : parsed.to !== parsed.from
          ? parsed.to
          : toHex6(tokens.accent ?? shiftHex(parsed.from, 40));
    apply({ ...parsed, mode, to });
  }

  return (
    <div className="studio-paint">
      <div className="studio-fill-mode" role="group">
        {(["solid", "linear", "radial"] as FillMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={parsed.mode === mode ? "on" : ""}
            onClick={() => setMode(mode)}
          >
            {t(`themes.fill.${mode}`)}
          </button>
        ))}
      </div>
      <ColorField value={parsed.from} onChange={(from) => apply({ ...parsed, from })} />
      {parsed.mode !== "solid" && (
        <>
          <ColorField
            value={parsed.to}
            ariaLabel={t("themes.fillTo")}
            onChange={(to) => apply({ ...parsed, to })}
          />
          {parsed.mode === "linear" && (
            <Slider
              min={0}
              max={360}
              value={parsed.angle}
              onChange={(angle) => apply({ ...parsed, angle })}
              format={(v) => `${v}°`}
            />
          )}
        </>
      )}
    </div>
  );
}

function ColorField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel?: string;
}) {
  const { t } = useTranslation();
  const parsed = parseColor(value);
  return (
    <div className="studio-color">
      <span className="studio-color-row">
        <i className="studio-swatch" style={{ ["--c" as string]: composeColor(parsed.rgb, parsed.alpha) }} />
        <input
          type="color"
          value={parsed.rgb}
          aria-label={ariaLabel}
          onChange={(e) => onChange(composeColor(e.target.value, parsed.alpha))}
        />
        <input
          value={value}
          spellCheck={false}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            const next = tryHexColor(value);
            if (next) onChange(next);
          }}
        />
      </span>
      <span className="studio-opacity">
        <span>{t("themes.opacity")}</span>
        <Slider
          min={0}
          max={100}
          value={parsed.alpha}
          onChange={(alpha) => onChange(composeColor(parsed.rgb, alpha))}
          format={(v) => `${v}%`}
        />
      </span>
    </div>
  );
}
