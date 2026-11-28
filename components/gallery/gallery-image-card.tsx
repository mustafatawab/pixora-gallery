import Image from "next/image"
import Link from "next/link"
import { Eye, EyeOff, ImageOff } from "lucide-react"
import { categoryLabel } from "@/lib/constants/categories"
import { cn } from "@/lib/utils"
import type { OwnerImage, PublicProfile } from "@/lib/types/domain"

type GalleryImageCardProps = {
  image: OwnerImage
  owner: PublicProfile
  /** Show the public/private badge (owner-facing views). */
  showVisibility?: boolean
  /** Mark images that belong to the signed-in viewer. */
  isOwn?: boolean
  /** Eager-load the first card so the feed's LCP image is not lazy. */
  priority?: boolean
}

export function GalleryImageCard({
  image,
  owner,
  showVisibility = false,
  isOwn = false,
  priority = false,
}: GalleryImageCardProps) {
  const isPublic = image.visibility === "public"
  const uploaded = new Date(image.created_at).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })

  return (
    <article className="group">
      <Link
        href={`/u/${owner.username}`}
        className="relative block aspect-square overflow-hidden bg-line/40"
        aria-label={`${image.title} by @${owner.username}`}
      >
        {image.signedUrl ? (
          <Image
            src={image.signedUrl}
            alt={image.title}
            fill
            unoptimized
            priority={priority}
            fetchPriority={priority ? "high" : "low"}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-8 w-8" />
            <span className="text-[11px]">Preview unavailable</span>
          </div>
        )}

        {isOwn && (
          <span className="absolute left-2 top-2 bg-paper/90 px-2 py-0.5 text-[10px] font-medium text-brand">
            Yours
          </span>
        )}

        {showVisibility && (
          <span
            className={cn(
              "absolute right-2 top-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium",
              isPublic ? "bg-paper/90 text-ink" : "bg-ink/85 text-paper",
            )}
          >
            {isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {isPublic ? "Public" : "Private"}
          </span>
        )}
      </Link>

      <div className="mt-3">
        <h3 className="truncate font-serif text-[17px] leading-tight text-ink transition-colors group-hover:text-brand">
          {image.title}
        </h3>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <Link
            href={`/u/${owner.username}`}
            className="truncate text-xs text-muted-foreground transition-colors hover:text-ink"
          >
            @{owner.username}
          </Link>
          <span className="shrink-0 text-[11px] text-muted-foreground">{uploaded}</span>
        </div>
        {(image.category || image.tags.length > 0) && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {image.category ? categoryLabel(image.category) : ""}
            {image.category && image.tags.length > 0 ? ", " : ""}
            {image.tags.length > 0 ? `#${image.tags.slice(0, 2).join(" #")}` : ""}
          </p>
        )}
      </div>
    </article>
  )
}
