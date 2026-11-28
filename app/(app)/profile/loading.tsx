import { GallerySkeleton } from "@/components/gallery/gallery-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
      <div className="border-b border-line py-10 lg:py-14">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-6">
            <Skeleton className="h-20 w-20 sm:h-24 sm:w-24" />
            <div>
              <Skeleton className="h-11 w-56" />
              <Skeleton className="mt-2 h-3 w-24" />
              <Skeleton className="mt-5 h-4 w-72" />
              <div className="mt-4 flex gap-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-11 w-32" />
            <Skeleton className="h-11 w-24" />
          </div>
        </div>
      </div>

      <div className="mt-8 border-b border-line pb-3">
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="mt-9 pb-16">
        <GallerySkeleton />
      </div>
    </div>
  )
}
