"use client"

import { useEffect } from "react"
import Link from "next/link"
import { RotateCcw } from "lucide-react"
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
    <div className="mx-auto flex min-h-[64vh] max-w-[1440px] flex-col justify-center px-5 py-20 sm:px-8">
      <h1 className="max-w-[16ch] font-serif text-5xl leading-[0.98] tracking-[-0.035em] text-ink sm:text-6xl">
        The gallery hit a snag.
      </h1>
      <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
        This page couldn&apos;t be loaded. It&apos;s usually temporary — try again, or head back to the gallery.
      </p>
      {error.digest && <p className="mt-3 text-xs text-muted-foreground">Reference: {error.digest}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-5">
        <Button type="button" onClick={reset}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
        <Link href="/" className="link-underline text-sm font-medium text-ink">
          Back to the gallery
        </Link>
      </div>
    </div>
  )
}
