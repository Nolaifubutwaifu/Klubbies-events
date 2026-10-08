"use client";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      {/* Inline styles in the current palette (paper, ink, Klubbies blue):
          the stylesheet may be what failed to load. */}
      <body style={{ margin: 0, background: "#f7f7f5", color: "#16181d", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ padding: 24, maxWidth: 520 }}>
          <p style={{ fontWeight: 600, fontSize: 18 }}>
            Klubbies <span style={{ color: "#66696f", fontWeight: 400 }}>Events</span>
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", margin: "48px 0 12px" }}>Something went wrong.</h1>
          <p style={{ fontSize: 16, color: "#4a4d55" }}>We&apos;ve been notified. Try again in a moment.</p>
          {error.digest ? <p style={{ fontSize: 14, color: "#66696f" }}>Reference: {error.digest}</p> : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 16, background: "#2b4acb", color: "#ffffff", border: 0, borderRadius: 10, minHeight: 48, padding: "0 22px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
