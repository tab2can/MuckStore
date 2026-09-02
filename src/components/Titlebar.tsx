import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isTauri } from "../lib/api";
import { useApp } from "../stores/useApp";

export function Titlebar() {
  const [maximized, setMaximized] = useState(false);
  const trayEnabled = useApp((s) => s.settings?.trayEnabled ?? false);

  useEffect(() => {
    if (!isTauri) return;
    const win = getCurrentWindow();
    void win.isMaximized().then(setMaximized).catch(() => undefined);
    const un = win.listen("tauri://resize", () => {
      void win.isMaximized().then(setMaximized).catch(() => undefined);
    });
    return () => {
      void un.then((fn) => fn());
    };
  }, []);

  async function act(kind: "min" | "max" | "close") {
    if (!isTauri) return;
    const win = getCurrentWindow();
    if (kind === "min") await win.minimize();
    if (kind === "max") await win.toggleMaximize();
    if (kind === "close") {
      if (trayEnabled) await win.hide();
      else await win.close();
    }
  }

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand" data-tauri-drag-region>
        <strong>MUCK</strong> STORE
      </div>
      <div className="titlebar-space" data-tauri-drag-region />
      {isTauri && (
        <div className="titlebar-controls">
          <button className="titlebar-btn" type="button" aria-label="Minimize" onClick={() => void act("min")}>
            <Minus size={12} />
          </button>
          <button className="titlebar-btn" type="button" aria-label="Maximize" onClick={() => void act("max")}>
            <Square size={9} strokeWidth={maximized ? 2.4 : 2} />
          </button>
          <button className="titlebar-btn close" type="button" aria-label="Close" onClick={() => void act("close")}>
            <X size={12} />
          </button>
        </div>
      )}
    </header>
  );
}
