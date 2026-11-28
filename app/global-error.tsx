"use client"

import { useEffect } from "react"

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Last-resort boundary. It replaces the root layout, so it must render its own
 * <html> and <body> and cannot rely on app styles or components.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[app] root error", error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          background: "#f4f3ef",
          color: "#111110",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          margin: 0,
          minHeight: "100vh",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "32rem" }}>
          <p
            style={{
              color: "#2536d8",
              fontSize: "1.5rem",
              letterSpacing: "-0.03em",
              margin: "0 0 1.5rem",
            }}
          >
            Pixora<span style={{ color: "#111110" }}>.</span>
          </p>
          <h1
            style={{
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: "2.25rem",
              fontWeight: 400,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              margin: "0 0 1rem",
            }}
          >
            Pixora couldn&apos;t start.
          </h1>
          <p style={{ color: "#57564f", fontSize: "0.9rem", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
            The application hit an unexpected error. Reload the page; if it keeps happening, check the service status.
          </p>
          {error.digest && (
            <p style={{ color: "#8a887e", fontSize: "0.75rem", margin: "0 0 1.5rem" }}>Reference: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#111110",
              border: 0,
              borderRadius: "2px",
              color: "#f4f3ef",
              cursor: "pointer",
              fontSize: "0.875rem",
              padding: "0.7rem 1.1rem",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
