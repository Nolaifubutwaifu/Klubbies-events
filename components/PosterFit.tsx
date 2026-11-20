"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Shrinks the A4 poster to fit a narrow screen, so a phone shows the whole
 * sheet instead of its left half. Screen only: print resets it (poster page).
 */
export function PosterFit({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      el.style.removeProperty("zoom");
      const scale = Math.min(1, (window.innerWidth - 32) / el.offsetWidth);
      if (scale < 1) el.style.setProperty("zoom", String(scale));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div ref={box} className="poster-fit">
      {children}
    </div>
  );
}
