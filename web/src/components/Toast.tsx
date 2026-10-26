import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type ToastKind = "info" | "success" | "warn" | "error";
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
  simulated?: boolean;
}

type Show = (text: string, opts?: { kind?: ToastKind; simulated?: boolean; ms?: number }) => void;
const Ctx = createContext<Show>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback<Show>((text, opts = {}) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), kind: opts.kind ?? "info", text, simulated: opts.simulated });
    timer.current = setTimeout(() => setToast(null), opts.ms ?? Math.min(9000, 3500 + text.length * 35));
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toast && (
          <div key={toast.id} className={`toast toast--${toast.kind}`} role="status">
            {toast.simulated && <span className="badge badge--sim">Simulated</span>}
            <span>{toast.text}</span>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
