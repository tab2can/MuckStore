import { useState, type PointerEvent as ReactPointerEvent } from "react";

export const NAV_ICON_WIDTH = 52;
export const NAV_SNAP_WIDTH = 128;
export const NAV_MIN_WIDTH = 168;
export const NAV_MAX_WIDTH = 300;
export const NAV_DEFAULT_WIDTH = 188;

export function clampNavWidth(next: number) {
  if (next < NAV_SNAP_WIDTH) return NAV_ICON_WIDTH;
  return Math.min(NAV_MAX_WIDTH, Math.max(NAV_MIN_WIDTH, next));
}

export function readNavWidth(key: string, fallback = NAV_DEFAULT_WIDTH) {
  try {
    const n = Number(localStorage.getItem(key));
    if (Number.isFinite(n) && n >= NAV_ICON_WIDTH && n <= NAV_MAX_WIDTH) return n;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function persistNavWidth(key: string, n: number) {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    /* ignore */
  }
}

export function useNavWidth(storageKey: string) {
  const [width, setWidth] = useState(() => readNavWidth(storageKey));
  const [dragging, setDragging] = useState(false);
  const collapsed = width <= NAV_ICON_WIDTH;

  function onResizePointerDown(
    e: ReactPointerEvent<HTMLDivElement>,
    paneSelector: string,
    growToward: "left" | "right" = "right",
  ) {
    e.preventDefault();
    const handle = e.currentTarget;
    const pane = handle.closest(paneSelector);
    if (!pane) return;
    handle.setPointerCapture(e.pointerId);
    setDragging(true);
    const start = pane.getBoundingClientRect();

    const move = (ev: PointerEvent) => {
      const raw = growToward === "left" ? start.right - ev.clientX : ev.clientX - start.left;
      setWidth(clampNavWidth(raw));
    };
    const up = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragging(false);
      setWidth((w) => {
        persistNavWidth(storageKey, w);
        return w;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return { width, collapsed, dragging, onResizePointerDown };
}
