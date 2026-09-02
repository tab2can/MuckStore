import type { CSSProperties } from "react";
import { tokensToStyle } from "../lib/themes";

export function ThemeChromePreview({ tokens }: { tokens: Record<string, string> }) {
  return (
    <div className="theme-mini" style={tokensToStyle(tokens) as CSSProperties} aria-hidden>
      <div className="theme-mini-bar">
        <strong>MUCK</strong>
        <span>
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="theme-mini-body">
        <div className="theme-mini-side">
          <b className="on" />
          <b />
          <b />
        </div>
        <div className="theme-mini-main">
          <em />
          <div className="theme-mini-cards">
            <span />
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}
