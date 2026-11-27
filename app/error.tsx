"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[app] unhandled error", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <AlertTriangle className="mb-4 h-16 w-16 text-amber-500" />
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Something went wrong</h1>
      <p className="mb-6 max-w-md text-gray-600">
        The page couldn&apos;t be loaded. This is usually temporary — try again, or head back to the gallery.
      </p>
      {error.digest && <p className="mb-6 text-xs text-gray-400">Reference: {error.digest}</p>}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to the gallery</Link>
        </Button>
      </div>
    </div>
  )
}
