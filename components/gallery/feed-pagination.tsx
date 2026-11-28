import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

type FeedPaginationProps = {
  page: number
  totalPages: number
  search: string
  category: string
}

function pageHref(page: number, search: string, category: string): string {
  const params = new URLSearchParams()
  if (search) params.set("q", search)
  if (category) params.set("category", category)
  if (page > 1) params.set("page", String(page))

  const query = params.toString()
  return query ? `/?${query}` : "/"
}

export function FeedPagination({ page, totalPages, search, category }: FeedPaginationProps) {
  if (totalPages <= 1) return null

  const hasPrevious = page > 1
  const hasNext = page < totalPages

  return (
    <nav
      aria-label="Gallery pagination"
      className="mt-14 flex items-center justify-between border-t border-line pt-6 text-sm"
    >
      {hasPrevious ? (
        <Link
          href={pageHref(page - 1, search, category)}
          rel="prev"
          className="inline-flex items-center gap-1.5 font-medium text-ink transition-colors hover:text-brand"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground/50">
          <ChevronLeft className="h-4 w-4" />
          Previous
        </span>
      )}

      <span className="text-xs text-muted-foreground" aria-current="page">
        Page {page} of {totalPages}
      </span>

      {hasNext ? (
        <Link
          href={pageHref(page + 1, search, category)}
          rel="next"
          className="inline-flex items-center gap-1.5 font-medium text-ink transition-colors hover:text-brand"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground/50">
          Next
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  )
}
