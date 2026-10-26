import { useEffect, useRef } from "react";
import { KEY_TO_DIRECTION, isBackKey, moveFocus, textFieldKeepsKey } from "./spatialNav";

declare global {
  interface Window {
    /** Called by the Android shell (MainActivity.java). */
    grantos?: { onBack?: () => void; onHome?: () => void; onShow?: () => void; onHide?: () => void };
  }
}

/**
 * Wires the remote (and a desktop keyboard) to GrantOS:
 * arrows move focus, Enter/OK activates (native button behaviour), Back/Escape calls onBack.
 * The Android shell swallows the hardware Back key and calls window.grantos.onBack() instead.
 */
export function useRemote(handlers: { onBack: () => void; onHome?: () => void; onShow?: () => void }) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_TO_DIRECTION[e.key];
      if (dir) {
        if (textFieldKeepsKey(document.activeElement, dir)) return;
        e.preventDefault();
        moveFocus(dir);
        return;
      }
      if (isBackKey(e)) {
        e.preventDefault();
        ref.current.onBack();
      }
    };
    document.addEventListener("keydown", onKey);
    window.grantos = {
      onBack: () => ref.current.onBack(),
      onHome: () => ref.current.onHome?.(),
      onShow: () => ref.current.onShow?.(),
    };
    return () => {
      document.removeEventListener("keydown", onKey);
      window.grantos = undefined;
    };
  }, []);
}
