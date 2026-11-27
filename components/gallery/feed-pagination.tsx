import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

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
    <nav aria-label="Gallery pagination" className="mt-10 flex items-center justify-center gap-4">
      {hasPrevious ? (
        <Button asChild variant="outline">
          <Link href={pageHref(page - 1, search, category)} rel="prev">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
      )}

      <span className="text-sm text-gray-600" aria-current="page">
        Page {page} of {totalPages}
      </span>

      {hasNext ? (
        <Button asChild variant="outline">
          <Link href={pageHref(page + 1, search, category)} rel="next">
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      )}
    </nav>
  )
}
