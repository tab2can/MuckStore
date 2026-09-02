import { useLayoutEffect, useRef, useState } from "react";
import { useApp } from "../../stores/useApp";
import { motionEnabled } from "../../lib/motion";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { id: T; label: string }[];
}) {
  const settings = useApp((s) => s.settings);
  const motion = motionEnabled(settings);
  const root = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ x: 3, w: 0 });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const pane = root.current;
    if (!pane) return;
    const measure = () => {
      const active = pane.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (!active) return;
      setThumb({ x: active.offsetLeft, w: active.offsetWidth });
      setReady(true);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pane);
    return () => ro.disconnect();
  }, [value, options]);

  return (
    <div className={`segmented${ready ? " ready" : ""}`} role="group" ref={root}>
      <i
        className="segmented-thumb"
        aria-hidden
        style={{
          width: thumb.w,
          transform: `translateX(${thumb.x}px)`,
          transition: motion && ready ? undefined : "none",
        }}
      />
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
