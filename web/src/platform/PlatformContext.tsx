import { createContext, useContext } from "react";
import type { Platform } from "./types";

export const PlatformContext = createContext<Platform | null>(null);

export function usePlatform(): Platform {
  const p = useContext(PlatformContext);
  if (!p) throw new Error("usePlatform outside PlatformContext");
  return p;
}
