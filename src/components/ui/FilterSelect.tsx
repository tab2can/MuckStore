import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useApp } from "../../stores/useApp";
import { motionEnabled } from "../../lib/motion";

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  label,
  allowEmpty = true,
  align = "start",
}: {
  value: string;
  onChange: (next: string) => void;
  options: { id: string; label: string }[];
  placeholder: string;
  label: string;
  allowEmpty?: boolean;
  align?: "start" | "end";
}) {
  const settings = useApp((s) => s.settings);
  const motion = motionEnabled(settings);
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState({ top: 0, left: 0, width: 196 });
  const root = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = options.find((o) => o.id === value);

  useLayoutEffect(() => {
    if (!open) return;
    const btn = root.current?.querySelector("button");
    if (!btn) return;
    const place = () => {
      const r = btn.getBoundingClientRect();
      const width = Math.max(r.width, 196);
      const left = align === "end" ? r.right - width : r.left;
      setMenuBox({
        top: r.bottom + 8,
        left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
        width,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, value, options]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (root.current?.contains(node) || menuRef.current?.contains(node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = open
    ? createPortal(
        <div
          className={`filter-menu${motion ? " anim" : ""}`}
          role="listbox"
          id={menuId}
          aria-label={label}
          ref={menuRef}
          style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
        >
          {allowEmpty && (
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {placeholder}
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={opt.id === value}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={`filter-select${open ? " open" : ""}`} ref={root}>
      <button
        type="button"
        className="filter-select-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDown size={14} strokeWidth={2.2} />
      </button>
      {menu}
    </div>
  );
}
