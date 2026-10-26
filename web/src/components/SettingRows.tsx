import { useEffect, useState, type ReactNode } from "react";

/** Settings rows. Every row is one focusable control so the remote can reach it with arrows + OK. */

export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="group">
      <h3 className="group__label">{label}</h3>
      {children}
    </section>
  );
}

const Text = ({ label, desc }: { label: string; desc?: ReactNode }) => (
  <div className="row__text">
    <div className="row__label">{label}</div>
    {desc && <div className="row__desc">{desc}</div>}
  </div>
);

export function ToggleRow({ label, desc, value, onChange, id }: { label: string; desc?: ReactNode; value: boolean; onChange: (v: boolean) => void; id?: string }) {
  return (
    <button id={id} className="row" data-nav role="switch" aria-checked={value} onClick={() => onChange(!value)}>
      <Text label={label} desc={desc} />
      <span className="row__value">
        {value ? "On" : "Off"}
        <span className="switch" data-on={value} />
      </span>
    </button>
  );
}

/** OK cycles through the options. */
export function ChoiceRow<T extends string | number>({
  label,
  desc,
  value,
  options,
  onChange,
  id,
}: {
  label: string;
  desc?: ReactNode;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  id?: string;
}) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <button id={id} className="row" data-nav onClick={() => onChange(options[(i + 1) % options.length].value)} aria-label={`${label}: ${options[i]?.label}`}>
      <Text label={label} desc={desc} />
      <span className="row__value">
        {options[i]?.label} <span style={{ opacity: 0.5 }}>›</span>
      </span>
    </button>
  );
}

/** Saves when the field loses focus or OK/Enter is pressed (the Fire TV keyboard sends Enter). */
export function TextRow({
  label,
  desc,
  value,
  onChange,
  placeholder,
  secret = false,
  inputMode,
  id,
}: {
  label: string;
  desc?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
  inputMode?: "text" | "decimal" | "url";
  id?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft !== value && onChange(draft);
  return (
    <label className="row">
      <Text label={label} desc={desc} />
      <input
        id={id}
        className="field"
        data-nav
        type={secret ? "password" : "text"}
        value={draft}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
      />
    </label>
  );
}

export function StepperRow({
  label,
  desc,
  value,
  min,
  max,
  step = 1,
  format = String,
  onChange,
}: {
  label: string;
  desc?: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v / step) * step)));
  return (
    <div className="row">
      <Text label={label} desc={desc} />
      <div className="stepper">
        <button className="stepper__btn" data-nav aria-label={`Decrease ${label}`} onClick={() => set(value - step)}>
          −
        </button>
        <span className="stepper__value" aria-live="polite">
          {format(value)}
        </span>
        <button className="stepper__btn" data-nav aria-label={`Increase ${label}`} onClick={() => set(value + step)}>
          +
        </button>
      </div>
    </div>
  );
}

export function Info({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="info">
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
