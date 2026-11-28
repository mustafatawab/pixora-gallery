import { GallerySkeleton } from "@/components/gallery/gallery-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div>
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-[1440px] items-end gap-12 px-5 py-14 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:py-24">
          <div className="lg:col-span-7">
            <Skeleton className="h-14 w-4/5" />
            <Skeleton className="mt-3 h-14 w-3/5" />
            <Skeleton className="mt-8 h-4 w-72" />
            <div className="mt-9 flex gap-5">
              <Skeleton className="h-12 w-44" />
              <Skeleton className="h-12 w-32" />
            </div>
          </div>

          <div className="lg:col-span-5">
            <Skeleton className="aspect-[4/5] w-full" />
            <div className="mt-3 flex items-baseline justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-7">
          <div>
            <Skeleton className="h-9 w-48" />
            <Skeleton className="mt-3 h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-full max-w-sm" />
        </div>

        <div className="mt-9">
          <GallerySkeleton />
        </div>
      </section>
    </div>
  )
}
