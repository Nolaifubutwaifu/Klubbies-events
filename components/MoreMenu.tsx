"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Where a screen's secondary actions live. The screen shows its one or two
 * main actions as buttons; everything else goes in here, so the page says
 * what it is for at a glance and the long tail is one tap away.
 *
 * Items are plain children (links, buttons, forms with a button), so server
 * components can fill it. Closes on Escape, outside click or choosing an item,
 * and hands focus back to the button.
 */
export function MoreMenu({
  children,
  label = "More",
  align = "end",
  iconOnly = false,
  trigger,
  triggerClassName,
  rootClassName = "relative inline-flex",
  menuClassName,
}: {
  children: ReactNode;
  label?: string;
  align?: "start" | "end";
  /** A round ⋯ button, for tight rows. The label becomes its aria-label. */
  iconOnly?: boolean;
  /** Custom button content (an avatar, say). `label` becomes its aria-label. */
  trigger?: ReactNode;
  triggerClassName?: string;
  /** Leave out `relative` to position the menu against a wider ancestor. */
  rootClassName?: string;
  /** Replaces the default left or right placement. */
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  // Flip to the other side when the preferred one would run off a narrow
  // screen (the album menu opened 60pt past the left edge on a phone).
  useLayoutEffect(() => {
    const panel = menu.current;
    if (!open || !panel || menuClassName) return;
    const rect = panel.getBoundingClientRect();
    if (rect.left < 8) {
      panel.style.left = "0";
      panel.style.right = "auto";
    } else if (rect.right > window.innerWidth - 8) {
      panel.style.right = "0";
      panel.style.left = "auto";
    }
  }, [open, menuClassName]);

  useEffect(() => {
    if (!open) return;
    const first = root.current?.querySelector<HTMLElement>("[role=menu] a, [role=menu] button");
    first?.focus();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onPointer = (ev: PointerEvent) => {
      if (!root.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className={rootClassName}>
      <button
        ref={button}
        type="button"
        className={triggerClassName ?? (iconOnly ? "kb-icon-btn" : "btn btn-ghost")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={iconOnly || trigger ? label : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger ?? (
          <>
            {iconOnly ? null : label}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </>
        )}
      </button>
      {open ? (
        <div
          ref={menu}
          id={id}
          role="menu"
          className={`kb-menu top-[calc(100%+8px)] ${menuClassName ?? (align === "end" ? "right-0" : "left-0")}`}
          onClick={(ev) => {
            // Choosing anything closes the menu. A form's submit still fires.
            if ((ev.target as HTMLElement).closest("a, button")) setOpen(false);
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MoreLink({ href, children, danger = false }: { href: string; children: ReactNode; danger?: boolean }) {
  return (
    <Link href={href} role="menuitem" className="kb-menu-item" data-danger={danger || undefined}>
      {children}
    </Link>
  );
}

export function MoreButton({
  onClick,
  children,
  danger = false,
  type = "button",
  disabled,
}: {
  onClick?: () => void;
  children: ReactNode;
  danger?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      role="menuitem"
      className="kb-menu-item"
      data-danger={danger || undefined}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function MoreSeparator() {
  return <div className="kb-menu-sep" role="separator" />;
}
