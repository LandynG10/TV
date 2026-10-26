import { useEffect, useRef, useState } from "react";
import { CheckIcon, CrossIcon, DashIcon, GamepadIcon, SpinnerIcon } from "../components/Icons";
import { useSettings } from "../lib/SettingsContext";
import { focusFirst } from "../lib/spatialNav";
import { usePlatform } from "../platform/PlatformContext";
import { initialPs5Steps, runPs5Flow, type FlowStep } from "../services/ps5Flow";

const ICON = {
  pending: <DashIcon />,
  running: <SpinnerIcon />,
  ok: <CheckIcon />,
  skipped: <DashIcon />,
  warn: <DashIcon />,
  failed: <CrossIcon />,
};

export function Ps5Overlay({ onClose, onOpenSettings }: { onClose: () => void; onOpenSettings: () => void }) {
  const platform = usePlatform();
  const { settings } = useSettings();
  const [steps, setSteps] = useState<FlowStep[]>(() => initialPs5Steps(settings));
  const [running, setRunning] = useState(true);
  const [run, setRun] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setRunning(true);
    setSteps(initialPs5Steps(settings));
    runPs5Flow(platform, settings, (s) => alive && setSteps(s)).finally(() => alive && setRunning(false));
    return () => {
      alive = false;
    };
    // Re-run only when "Try again" is chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  useEffect(() => {
    if (!running && root.current) focusFirst(root.current);
  }, [running]);

  const switched = steps.find((s) => s.id === "input")?.state === "ok";
  const simulated = !platform.real.network;

  return (
    <div className="overlay" data-nav-root ref={root} data-testid="ps5-overlay">
      <div className="dialog" role="dialog" aria-label="PlayStation 5">
        <div className="dialog__head">
          <div className="tile__icon" style={{ background: "linear-gradient(135deg,#4c8bff,#1f4fd6)", width: "4.25rem", height: "4.25rem" }}>
            <GamepadIcon />
          </div>
          <h2 className="dialog__title">PlayStation 5</h2>
          {simulated && <span className="badge badge--sim">Simulated</span>}
        </div>
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.id} className="step" data-state={s.state} data-testid={`step-${s.id}`}>
              <span className="step__icon">{ICON[s.state]}</span>
              <div>
                <div className="step__title">{s.title}</div>
                {s.detail && <div className="step__detail">{s.detail}</div>}
              </div>
            </li>
          ))}
        </ol>
        {!running && (
          <div className="dialog__actions">
            <button className="pill" data-nav data-autofocus onClick={onClose}>
              {switched ? "Done" : "Back to GrantOS"}
            </button>
            <button className="pill pill--quiet" data-nav onClick={() => setRun((n) => n + 1)}>
              Try again
            </button>
            <button className="pill pill--quiet" data-nav onClick={onOpenSettings}>
              PS5 settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
