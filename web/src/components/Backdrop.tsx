import { useEffect, useState } from "react";
import type { Settings } from "../lib/settings";

/** Wallpaper: a gradient preset, slowly drifting aurora light, or a custom image with a dimmer. */
export function Backdrop({ background }: { background: Settings["background"] }) {
  const { kind, gradient, imageUrl, dim } = background;
  const [imageOk, setImageOk] = useState(false);

  useEffect(() => {
    setImageOk(false);
    if (kind !== "image" || !imageUrl) return;
    const img = new Image();
    img.onload = () => setImageOk(true);
    img.onerror = () => setImageOk(false);
    img.src = imageUrl;
  }, [kind, imageUrl]);

  const showImage = kind === "image" && imageOk;
  return (
    <div className="backdrop" data-gradient={gradient} aria-hidden="true">
      {kind === "aurora" && (
        <>
          <div className="aurora aurora--a" />
          <div className="aurora aurora--b" />
        </>
      )}
      {showImage && <div className="backdrop__image" style={{ backgroundImage: `url("${imageUrl.replace(/"/g, "%22")}")` }} />}
      {showImage && <div className="backdrop__dim" style={{ opacity: Math.max(0.15, dim / 80) }} />}
    </div>
  );
}
