"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Shrinks the A4 poster to fit a narrow screen, so a phone shows the whole
 * sheet instead of its left half. Screen only: print resets it (poster page).
 * A transform, not CSS zoom: iOS Safari zoomed the sheet but not its text.
 */
export function PosterFit({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = outer.current;
    const sheet = inner.current;
    if (!box || !sheet) return;
    const fit = () => {
      sheet.style.transform = "";
      box.style.width = "";
      box.style.height = "";
      const scale = Math.min(1, (window.innerWidth - 32) / sheet.offsetWidth);
      if (scale >= 1) return;
      // A transform doesn't change layout, so the box takes the shrunk size.
      sheet.style.transform = `scale(${scale})`;
      box.style.width = `${sheet.offsetWidth * scale}px`;
      box.style.height = `${sheet.offsetHeight * scale}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div ref={outer} className="poster-fit">
      <div ref={inner} className="origin-top-left">
        {children}
      </div>
    </div>
  );
}
