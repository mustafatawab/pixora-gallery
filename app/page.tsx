import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Upload } from "lucide-react"
import { getCurrentProfile } from "@/lib/auth/current-user"
import { categoryLabel, isImageCategory } from "@/lib/constants/categories"
import { getPublicFeed } from "@/lib/services/images"
import { FeedFilters } from "@/components/gallery/feed-filters"
import { FeedPagination } from "@/components/gallery/feed-pagination"
import { GalleryImageCard } from "@/components/gallery/gallery-image-card"
import { Button } from "@/components/ui/button"
import type { FeedImage } from "@/lib/types/domain"

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

  const featured =
    page === 1 && !isFiltered
      ? (images.find((image) => image.signedUrl) ?? images[0] ?? null)
      : null
  const gridImages = featured ? images.filter((image) => image.id !== featured.id) : images

  return (
    <div className="min-h-screen">
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
          <div className="grid items-end gap-12 py-14 lg:grid-cols-12 lg:gap-16 lg:py-24">
            <div className="animate-hero-rise lg:col-span-7">
              <h1 className="max-w-[11ch] text-[46px] leading-[0.95] tracking-[-0.035em] text-ink sm:text-6xl lg:text-[78px]">
                Photographs worth pausing for.
              </h1>
              <p className="mt-7 max-w-md text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                An independent gallery for photographers. Publish your work when you&apos;re ready — keep it private
                until then.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-6">
                <Button asChild size="lg">
                  <a href="#gallery">Browse the gallery</a>
                </Button>
                {viewer ? (
                  <Link href="/upload" className="link-underline text-sm font-medium text-ink">
                    Share your work
                  </Link>
                ) : (
                  <Link href="/register" className="link-underline text-sm font-medium text-ink">
                    Start your gallery
                  </Link>
                )}
              </div>
            </div>

            <div className="lg:col-span-5">
              <FeaturedFrame image={featured} viewer={Boolean(viewer)} />
            </div>
          </div>
        </div>
      </section>

      <section id="gallery" className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:py-16">
        <div className="flex flex-col gap-7 border-b border-line pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl text-ink sm:text-4xl">
              {isFiltered ? "Search results" : "The gallery"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isEmpty
                ? isFiltered
                  ? "Nothing matched this search."
                  : "No public photographs yet."
                : `${total} public photograph${total === 1 ? "" : "s"}, page ${page} of ${totalPages}`}
            </p>
          </div>

          <FeedFilters search={search} category={category} />
        </div>

        {isEmpty ? (
          <EmptyGallery
            isOutOfRange={isOutOfRange}
            isFiltered={isFiltered}
            isSignedIn={Boolean(viewer)}
          />
        ) : (
          <>
            <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">
              {gridImages.map((image, index) => (
                <GalleryImageCard
                  key={image.id}
                  image={image}
                  owner={image.owner}
                  isOwn={viewer?.id === image.owner.id}
                  priority={!featured && index === 0}
                />
              ))}
            </div>

            <FeedPagination page={page} totalPages={totalPages} search={search} category={category} />
          </>
        )}
      </section>
    </div>
  )
}

function FeaturedFrame({ image, viewer }: { image: FeedImage | null; viewer: boolean }) {
  if (!image) {
    return (
      <div className="flex aspect-[4/5] flex-col justify-between border border-line bg-card p-7 sm:p-8">
        <span className="h-2 w-2 bg-brand" aria-hidden="true" />
        <div>
          <p className="max-w-[14ch] font-serif text-3xl leading-[1.05] text-ink sm:text-4xl">
            The first frame is still to come.
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Be the first to publish a photograph in the public gallery.
          </p>
          <Link
            href={viewer ? "/upload" : "/register"}
            className="link-underline mt-6 inline-flex items-center gap-2 text-sm font-medium text-ink"
          >
            <Upload className="h-4 w-4" />
            {viewer ? "Upload a photograph" : "Create your account"}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <figure>
      <Link
        href={`/u/${image.owner.username}`}
        className="group relative block aspect-[4/5] overflow-hidden bg-line/40"
      >
        {image.signedUrl ? (
          <Image
            src={image.signedUrl}
            alt={image.title}
            fill
            unoptimized
            priority
            fetchPriority="high"
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <span className="font-serif text-2xl">Preview unavailable</span>
            <span className="text-xs">The original is still in the photographer&apos;s archive.</span>
          </div>
        )}
      </Link>
      <figcaption className="mt-3 flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-lg leading-tight text-ink">{image.title}</h2>
          <Link
            href={`/u/${image.owner.username}`}
            className="mt-1 block truncate text-xs text-muted-foreground transition-colors hover:text-ink"
          >
            @{image.owner.username}
          </Link>
        </div>
        {image.category && (
          <span className="shrink-0 text-xs text-muted-foreground">{categoryLabel(image.category)}</span>
        )}
      </figcaption>
    </figure>
  )
}

function EmptyGallery({
  isOutOfRange,
  isFiltered,
  isSignedIn,
}: {
  isOutOfRange: boolean
  isFiltered: boolean
  isSignedIn: boolean
}) {
  return (
    <div className="flex min-h-[42vh] flex-col items-center justify-center border-b border-line py-20 text-center">
      <p className="max-w-md font-serif text-3xl leading-tight text-ink sm:text-4xl">
        {isOutOfRange
          ? "This page is past the last frame."
          : isFiltered
            ? "No photographs match this search."
            : "The gallery is waiting for its first photograph."}
      </p>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {isOutOfRange
          ? "The gallery may have changed since this link was created."
          : isFiltered
            ? "Try a different photographer, tag, or category."
            : "Publish a photograph and it will appear here for everyone."}
      </p>

      <div className="mt-7">
        {isOutOfRange ? (
          <Button asChild variant="outline">
            <Link href="/">Back to page one</Link>
          </Button>
        ) : isFiltered ? (
          <Button asChild variant="outline">
            <Link href="/">Clear filters</Link>
          </Button>
        ) : isSignedIn ? (
          <Button asChild>
            <Link href="/upload">Upload a photograph</Link>
          </Button>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button asChild>
              <Link href="/register">Create an account</Link>
            </Button>
            <Link href="/login" className="link-underline text-sm font-medium text-ink">
              Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
