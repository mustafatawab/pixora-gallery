import type { Metadata } from "next"
import Link from "next/link"
import { Camera, Upload } from "lucide-react"
import { getCurrentProfile } from "@/lib/auth/current-user"
import { isImageCategory } from "@/lib/constants/categories"
import { getPublicFeed } from "@/lib/services/images"
import { FeedFilters } from "@/components/gallery/feed-filters"
import { FeedPagination } from "@/components/gallery/feed-pagination"
import { GalleryImageCard } from "@/components/gallery/gallery-image-card"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Discover photography",
  description:
    "Browse public photography from the Pixora community. Search by title, photographer, tag, or category.",
}

type HomePageProps = {
  searchParams: Promise<{ q?: string | string[]; category?: string | string[]; page?: string | string[] }>
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "")
}

function parsePage(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const search = first(params.q).trim().slice(0, 100)
  const rawCategory = first(params.category)
  const category = isImageCategory(rawCategory) ? rawCategory : ""
  const requestedPage = parsePage(first(params.page))

  const [feed, viewer] = await Promise.all([
    getPublicFeed({ search, category, page: requestedPage }),
    getCurrentProfile(),
  ])

  const { images, total, page, totalPages } = feed
  const isFiltered = Boolean(search || category)
  const isOutOfRange = page > totalPages && total > 0
  const isEmpty = images.length === 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="mb-6 text-4xl font-bold text-gray-900 sm:text-5xl">Discover Amazing Photography</h1>
            <p className="mx-auto mb-8 max-w-3xl text-lg text-gray-600 sm:text-xl">
              Explore a curated collection of images from photographers around the world. Share your own work and
              connect with a community of visual storytellers.
            </p>

            <FeedFilters search={search} category={category} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {isEmpty ? (
          <div className="py-16 text-center">
            <Camera className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <p className="mb-2 text-xl text-gray-600">
              {isOutOfRange
                ? "There are no images on this page."
                : isFiltered
                  ? "No images found matching your criteria."
                  : "No public images yet."}
            </p>
            <p className="mb-6 text-gray-400">
              {isOutOfRange
                ? "The gallery may have shrunk since this link was created."
                : isFiltered
                  ? "Try different keywords or browse the full gallery."
                  : "Be the first to share your photography with the community."}
            </p>

            {isOutOfRange ? (
              <Button asChild variant="outline">
                <Link href="/">Back to page 1</Link>
              </Button>
            ) : isFiltered ? (
              <Button asChild variant="outline">
                <Link href="/">Clear filters</Link>
              </Button>
            ) : viewer ? (
              <Button asChild>
                <Link href="/upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload an image
                </Link>
              </Button>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild>
                  <Link href="/register">Join Pixora</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-gray-900">
                {isFiltered ? `Search results (${total})` : `Public gallery (${total})`}
              </h2>
              <p className="text-sm text-gray-500">
                {isFiltered ? "Filtered from the public gallery" : "Latest uploads from the community"}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {images.map((image, index) => (
                <GalleryImageCard
                  key={image.id}
                  image={image}
                  owner={image.owner}
                  isOwn={viewer?.id === image.owner.id}
                  priority={index === 0}
                />
              ))}
            </div>

            <FeedPagination page={page} totalPages={totalPages} search={search} category={category} />
          </>
        )}
      </div>
    </div>
  )
}
