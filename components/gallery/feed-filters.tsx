import Link from "next/link"
import { Filter, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IMAGE_CATEGORIES, categoryLabel } from "@/lib/constants/categories"

type FeedFiltersProps = {
  search: string
  category: string
}

export function FeedFilters({ search, category }: FeedFiltersProps) {
  const hasFilters = Boolean(search || category)

  return (
    <form action="/" method="get" className="mx-auto max-w-4xl space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <Input
          type="search"
          name="q"
          defaultValue={search}
          maxLength={100}
          placeholder="Search images, photographers, tags, or descriptions..."
          className="rounded-full border-2 border-gray-200 py-4 pl-12 pr-4 text-lg focus:border-blue-500"
        />
      </div>

      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <label htmlFor="category" className="sr-only">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={category || "all"}
            className="h-10 w-48 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {IMAGE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {categoryLabel(value)}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit">Search</Button>
        {hasFilters && (
          <Button asChild variant="outline">
            <Link href="/">Clear filters</Link>
          </Button>
        )}
      </div>
    </form>
  )
}
