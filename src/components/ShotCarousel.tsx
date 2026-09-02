import { useEffect, useRef, useState } from "react";
import { useApp } from "../stores/useApp";
import { motionEnabled } from "../lib/motion";

const AUTO_MS = 900;
const USER_MS = 320;
const AUTO_EVERY = 5200;

export function ShotCarousel({ images, label }: { images: string[]; label: string }) {
  const settings = useApp((s) => s.settings);
  const motion = motionEnabled(settings);
  const [index, setIndex] = useState(0);
  const [ms, setMs] = useState(AUTO_MS);
  const [paused, setPaused] = useState(false);
  const lock = useRef(false);
  const pane = useRef<HTMLElement>(null);
  const indexRef = useRef(0);
  indexRef.current = index;

  useEffect(() => {
    setIndex(0);
  }, [images.join("|")]);

  function go(next: number, speed: "auto" | "user") {
    const len = images.length;
    if (len < 2) return;
    const wrapped = ((next % len) + len) % len;
    if (wrapped === indexRef.current) return;
    setMs(motion ? (speed === "auto" ? AUTO_MS : USER_MS) : 0);
    setIndex(wrapped);
  }

  useEffect(() => {
    if (paused || images.length < 2) return;
    const id = window.setInterval(() => go(indexRef.current + 1, "auto"), AUTO_EVERY);
    return () => window.clearInterval(id);
  }, [paused, images.length, motion]);

  useEffect(() => {
    const el = pane.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (images.length < 2) return;
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
  }, [images.length, motion]);

  if (images.length === 0) return null;

  return (
    <section
      ref={pane}
      className="shot-stage"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className={i === index ? "on" : ""}
          style={{ ["--slide-ms" as string]: `${motion ? ms : 0}ms` }}
          draggable={false}
        />
      ))}
      {images.length > 1 && (
        <div className="spotlight-dots shot-dots" role="tablist">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${label} ${i + 1}`}
              className={i === index ? "on" : ""}
              onClick={() => go(i, "user")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
