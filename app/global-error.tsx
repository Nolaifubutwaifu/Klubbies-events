"use client";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fff8f4", color: "#2b2228", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ padding: 24, maxWidth: 520 }}>
          <p style={{ fontWeight: 700, fontSize: 20 }}>klubbies</p>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", margin: "48px 0 12px" }}>Klubbies hit a problem.</h1>
          <p style={{ fontSize: 16, color: "#5f545a" }}>We&apos;ve been notified. Try again in a moment.</p>
          {error.digest ? <p style={{ fontSize: 14, color: "#776b70" }}>Reference: {error.digest}</p> : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 16, background: "#cf2e12", color: "#ffffff", border: 0, borderRadius: 999, minHeight: 52, padding: "0 26px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
