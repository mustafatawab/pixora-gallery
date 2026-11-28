"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Eye, EyeOff, ImageOff, Loader2, Trash2 } from "lucide-react"
import { deleteImageAction, updateImageVisibilityAction } from "@/actions/images"
import { categoryLabel } from "@/lib/constants/categories"
import { formatBytes } from "@/lib/storage/paths"
import { cn } from "@/lib/utils"
import type { OwnerImage } from "@/lib/types/domain"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"

type ProfileImageCardProps = {
  image: OwnerImage
}

export function ProfileImageCard({ image }: ProfileImageCardProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deletePending, startDelete] = useTransition()
  const [visibilityPending, startVisibility] = useTransition()
  const [feedback, setFeedback] = useState<{ type: "error" | "warning"; message: string } | null>(null)

  const isPublic = image.visibility === "public"
  const uploaded = new Date(image.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const handleVisibility = () => {
    setFeedback(null)
    startVisibility(async () => {
      try {
        const result = await updateImageVisibilityAction({
          id: image.id,
          visibility: isPublic ? "private" : "public",
        })

        if (!result.ok) {
          setFeedback({ type: "error", message: result.error })
          return
        }

        router.refresh()
      } catch {
        setFeedback({ type: "error", message: "Could not update visibility. Please try again." })
      }
    })
  }

  const handleDelete = () => {
    setFeedback(null)
    startDelete(async () => {
      try {
        const result = await deleteImageAction({ id: image.id })

        if (!result.ok) {
          setFeedback({ type: "error", message: result.error })
          setOpen(false)
          return
        }

        if (result.warning) {
          setFeedback({ type: "warning", message: result.warning })
        }

        setOpen(false)
        router.refresh()
      } catch {
        setFeedback({ type: "error", message: "Could not delete the image. Please try again." })
        setOpen(false)
      }
    })
  }

  return (
    <article className="group">
      <div className="relative aspect-square overflow-hidden bg-line/40">
        {image.signedUrl ? (
          <Image
            src={image.signedUrl}
            alt={image.title}
            fill
            unoptimized
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-8 w-8" aria-hidden="true" />
            <span className="text-[11px]">Preview unavailable</span>
          </div>
        )}

        <span
          className={cn(
            "absolute left-2 top-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium",
            isPublic ? "bg-paper/90 text-ink" : "bg-ink/85 text-paper",
          )}
        >
          {isPublic ? <Eye className="h-3 w-3" aria-hidden="true" /> : <EyeOff className="h-3 w-3" aria-hidden="true" />}
          {isPublic ? "Public" : "Private"}
        </span>

        <AlertDialog open={open} onOpenChange={(next) => (!deletePending ? setOpen(next) : undefined)}>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center bg-paper/90 text-ink transition-colors hover:bg-destructive hover:text-paper focus-visible:bg-destructive focus-visible:text-paper sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              aria-label={`Delete ${image.title}`}
              disabled={visibilityPending}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-none border-line sm:rounded-none">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-serif text-2xl font-normal tracking-[-0.02em]">
                Delete this photograph?
              </AlertDialogTitle>
              <AlertDialogDescription className="leading-relaxed">
                “{image.title}” will be removed from your gallery and its stored file will be deleted. This cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deletePending}
                className="bg-destructive text-destructive-foreground hover:bg-[#8a1d19]"
                onClick={(event) => {
                  event.preventDefault()
                  handleDelete()
                }}
              >
                {deletePending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Deleting…
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="mt-3">
        <h3 className="truncate font-serif text-[17px] leading-tight text-ink" title={image.title}>
          {image.title}
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {uploaded}
          {image.size_bytes ? ` · ${formatBytes(image.size_bytes)}` : ""}
          {image.category ? ` · ${categoryLabel(image.category)}` : ""}
        </p>

        {image.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {image.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] font-normal">
                #{tag}
              </Badge>
            ))}
            {image.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{image.tags.length - 3}</span>
            )}
          </div>
        )}

        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-ink transition-colors hover:text-brand disabled:opacity-50"
          disabled={visibilityPending || deletePending}
          aria-busy={visibilityPending}
          onClick={handleVisibility}
        >
          {visibilityPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Updating…
            </>
          ) : isPublic ? (
            <>
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              Make private
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              Make public
            </>
          )}
        </button>

        {feedback && (
          <p
            role={feedback.type === "error" ? "alert" : "status"}
            className={cn(
              "mt-2 border-l-2 pl-2 text-[11px] leading-snug",
              feedback.type === "error"
                ? "border-destructive text-destructive"
                : "border-line text-muted-foreground",
            )}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </article>
  )
}
