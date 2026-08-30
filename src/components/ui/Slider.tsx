export function Slider({
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (next: number) => void;
  format?: (value: number) => string;
}) {
  const pct = ((value - min) / (max - min || 1)) * 100;
  return (
    <label className="slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        style={{ ["--pct" as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output>{format ? format(value) : value}</output>
    </label>
  );
}
