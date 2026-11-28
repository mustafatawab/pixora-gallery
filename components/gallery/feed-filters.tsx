import Link from "next/link"
import { Search } from "lucide-react"
import { IMAGE_CATEGORIES, categoryLabel } from "@/lib/constants/categories"
import { cn } from "@/lib/utils"

type FeedFiltersProps = {
  search: string
  category: string
}

function categoryHref(value: string, search: string): string {
  const params = new URLSearchParams()
  if (search) params.set("q", search)
  if (value) params.set("category", value)
  const query = params.toString()
  return query ? `/?${query}` : "/"
}

export function FeedFilters({ search, category }: FeedFiltersProps) {
  const hasFilters = Boolean(search || category)

  return (
    <div className="w-full lg:max-w-xl">
      <form
        action="/"
        method="get"
        role="search"
        className="flex items-center gap-3 border-b border-line pb-2 transition-colors focus-within:border-ink"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          name="q"
          defaultValue={search}
          maxLength={100}
          aria-label="Search photographs, photographers, tags, or descriptions"
          placeholder="Search photographs, people, tags"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground/70"
        />
        {category && <input type="hidden" name="category" value={category} />}
        <button type="submit" className="shrink-0 text-xs font-medium text-ink transition-colors hover:text-brand">
          Search
        </button>
      </form>

      <div className="mt-4 flex items-center gap-4 overflow-x-auto pb-1 lg:flex-wrap lg:gap-y-2 lg:overflow-visible">
        <Link
          href={categoryHref("", search)}
          className={cn(
            "shrink-0 border-b-2 pb-1 text-xs transition-colors",
            category ? "border-transparent text-muted-foreground hover:text-ink" : "border-brand text-ink",
          )}
          aria-current={!category ? "page" : undefined}
        >
          All
        </Link>
        {IMAGE_CATEGORIES.map((value) => {
          const active = category === value
          return (
            <Link
              key={value}
              href={categoryHref(value, search)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 border-b-2 pb-1 text-xs transition-colors",
                active
                  ? "border-brand text-ink"
                  : "border-transparent text-muted-foreground hover:text-ink",
              )}
            >
              {categoryLabel(value)}
            </Link>
          )
        })}
        {hasFilters && (
          <Link
            href="/"
            className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Clear
          </Link>
        )}
      </div>
    </div>
  )
}
