import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GitFork, Star } from "lucide-react";
import type { CatalogProgram } from "../lib/types";
import { displayName, displaySummary, formatCount, programLanguage } from "../lib/catalogBrowse";
import { useApp } from "../stores/useApp";
import { motionEnabled } from "../lib/motion";

const AUTO_MS = 900;
const USER_MS = 320;
const AUTO_EVERY = 5600;

export function HomeCarousel({
  title,
  kicker,
  programs,
  metric,
  locale,
  empty,
}: {
  title: string;
  kicker: string;
  programs: CatalogProgram[];
  metric: "stars" | "forks";
  locale: string;
  empty: string;
}) {
  const { t } = useTranslation();
  const settings = useApp((s) => s.settings);
  const motion = motionEnabled(settings);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [dir, setDir] = useState(1);
  const [ms, setMs] = useState(AUTO_MS);
  const [paused, setPaused] = useState(false);
  const lock = useRef(false);
  const pane = useRef<HTMLElement>(null);
  const indexRef = useRef(0);
  const ids = programs.map((p) => p.id).join("|");
  indexRef.current = index;

  useEffect(() => {
    setIndex(0);
    setLeaving(null);
  }, [ids]);

  function go(next: number, speed: "auto" | "user") {
    const len = programs.length;
    if (len < 2) return;
    const from = indexRef.current;
    const wrapped = ((next % len) + len) % len;
    if (wrapped === from) return;
    const forward = wrapped === (from + 1) % len;
    setDir(forward ? 1 : -1);
    setMs(motion ? (speed === "auto" ? AUTO_MS : USER_MS) : 0);
    if (motion) setLeaving(from);
    else setLeaving(null);
    setIndex(wrapped);
  }

  useEffect(() => {
    if (leaving === null) return;
    const id = window.setTimeout(() => setLeaving(null), ms);
    return () => window.clearTimeout(id);
  }, [leaving, ms]);

  useEffect(() => {
    if (paused || programs.length < 2) return;
    const id = window.setInterval(() => go(indexRef.current + 1, "auto"), AUTO_EVERY);
    return () => window.clearInterval(id);
  }, [paused, programs.length, motion]);

  useEffect(() => {
    const el = pane.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (programs.length < 2) return;
      e.preventDefault();
      if (lock.current) return;
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 8) return;
      lock.current = true;
      go(indexRef.current + (delta > 0 ? 1 : -1), "user");
      window.setTimeout(() => {
        lock.current = false;
      }, motion ? USER_MS : 80);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [programs.length, motion]);

  return (
    <section
      ref={pane}
      className={`spotlight metric-${metric}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="spotlight-glow" aria-hidden />
      <div className="spotlight-head">
        <p className="page-kicker">{kicker}</p>
        <h2>{title}</h2>
      </div>
      {programs.length === 0 ? (
        <p className="page-sub" style={{ margin: 0 }}>
          {empty}
        </p>
      ) : (
        <div className="spotlight-viewport">
          {programs.map((program, i) => (
            <Link
              key={program.id}
              to={`/program/${encodeURIComponent(program.id)}`}
              className={`spotlight-slide${i === index ? " on" : ""}${i === leaving ? " leaving" : ""}`}
              aria-hidden={i !== index}
              tabIndex={i === index ? 0 : -1}
              style={{
                ["--slide-ms" as string]: `${motion ? ms : 0}ms`,
                ["--slide-from" as string]: `${dir * 28}px`,
              }}
            >
              <div className="spotlight-rank">#{String(i + 1).padStart(2, "0")}</div>
              <h3>{displayName(program, locale)}</h3>
              <p>{displaySummary(program, locale)}</p>
              <div className="row">
                <span className="pill">
                  {metric === "stars" ? <Star size={12} /> : <GitFork size={12} />}
                  {formatCount((metric === "stars" ? program.stars : program.forks) ?? 0)}
                </span>
                {programLanguage(program) && <span className="pill">{programLanguage(program)}</span>}
                <span className={`pill ${program.official ? "ok" : "warn"}`}>
                  {program.official ? t("detail.officialBadge") : t("detail.communityBadge")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {programs.length > 1 && (
        <div className="spotlight-dots" role="tablist">
          {programs.map((program, i) => (
            <button
              key={program.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={displayName(program, locale)}
              className={i === index ? "on" : ""}
              onClick={() => go(i, "user")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
