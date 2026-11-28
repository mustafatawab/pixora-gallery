import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[64vh] max-w-[1440px] flex-col justify-center px-5 py-20 sm:px-8">
      <p className="text-xs text-muted-foreground">404</p>
      <h1 className="mt-4 max-w-[16ch] font-serif text-5xl leading-[0.98] tracking-[-0.035em] text-ink sm:text-7xl">
        This frame isn&apos;t in the archive.
      </h1>
      <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
        The page doesn&apos;t exist, or the photographer hasn&apos;t published a profile here.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-5">
        <Button asChild>
          <Link href="/">Back to the gallery</Link>
        </Button>
        <Link href="/register" className="link-underline text-sm font-medium text-ink">
          Create an account
        </Link>
      </div>
    </div>
  )
}
