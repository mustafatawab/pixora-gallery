import Image from "next/image"
import Link from "next/link"
import { Eye, EyeOff, ImageOff, Sparkles } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
  const uploaded = new Date(image.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        {image.signedUrl ? (
          <Image
            src={image.signedUrl}
            alt={image.title}
            fill
            unoptimized
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-600">
            <ImageOff className="h-10 w-10" />
            <span className="text-xs">Preview unavailable</span>
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
          {isOwn && (
            <Badge className="gap-1 bg-green-500 text-white hover:bg-green-600">
              <Sparkles className="h-3 w-3" />
              Your image
            </Badge>
          )}
          {showVisibility && (
            <Badge
              variant="secondary"
              className={`gap-1 text-xs ${
                isPublic ? "bg-white/90 text-green-700" : "bg-slate-900/80 text-white"
              }`}
            >
              {isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {isPublic ? "Public" : "Private"}
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4">
        <h3 className="mb-1 line-clamp-1 text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
          {image.title}
        </h3>
        {image.description && <p className="mb-3 line-clamp-2 text-sm text-gray-600">{image.description}</p>}

        {image.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {image.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                #{tag}
              </Badge>
            ))}
            {image.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{image.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/u/${owner.username}`}
            className="flex min-w-0 items-center space-x-2 hover:opacity-80"
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-blue-100 text-xs text-blue-600">
                {owner.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium text-gray-900">@{owner.username}</span>
              {owner.full_name && <span className="block truncate text-xs text-gray-500">{owner.full_name}</span>}
            </div>
          </Link>

          <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-gray-500">
            <span>{uploaded}</span>
            {image.category && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {image.category}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
