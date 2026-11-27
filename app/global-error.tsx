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
          alignItems: "center",
          background: "#f9fafb",
          color: "#111827",
          display: "flex",
          fontFamily: "system-ui, sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <main>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>Pixora couldn&apos;t start</h1>
          <p style={{ color: "#4b5563", marginBottom: "1.5rem", maxWidth: "28rem" }}>
            The application hit an unexpected error. Try reloading; if it keeps happening, check the service status.
          </p>
          {error.digest && (
            <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginBottom: "1.5rem" }}>Reference: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#111827",
              border: 0,
              borderRadius: "0.5rem",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "0.875rem",
              padding: "0.625rem 1rem",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
