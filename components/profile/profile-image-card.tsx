"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Eye, EyeOff, ImageOff, Loader2, Trash2 } from "lucide-react"
import { deleteImageAction, updateImageVisibilityAction } from "@/actions/images"
import { formatBytes } from "@/lib/storage/paths"
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
import { Button } from "@/components/ui/button"

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
  const uploaded = new Date(image.created_at).toLocaleDateString(undefined, {
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
    <div className="group overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="relative aspect-square bg-gray-100">
        {image.signedUrl ? (
          <Image
            src={image.signedUrl}
            alt={image.title}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-600">
            <ImageOff className="h-10 w-10" />
            <span className="text-xs">Preview unavailable</span>
          </div>
        )}

        <Badge
          variant="secondary"
          className={`absolute top-2 left-2 gap-1 text-xs ${
            isPublic ? "bg-white/90 text-green-700" : "bg-slate-900/80 text-white"
          }`}
        >
          {isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {isPublic ? "Public" : "Private"}
        </Badge>

        <AlertDialog open={open} onOpenChange={(next) => (!deletePending ? setOpen(next) : undefined)}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 h-8 w-8 rounded-full p-0 bg-white/90 text-gray-700 hover:bg-white hover:text-red-600"
              aria-label={`Delete ${image.title}`}
              disabled={visibilityPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this image?</AlertDialogTitle>
              <AlertDialogDescription>
                “{image.title}” will be removed from your gallery and its stored file will be deleted. This cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deletePending}
                className="bg-red-600 hover:bg-red-700"
                onClick={(event) => {
                  event.preventDefault()
                  handleDelete()
                }}
              >
                {deletePending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

      <div className="space-y-2 p-3">
        <div>
          <h3 className="truncate font-medium text-gray-900" title={image.title}>
            {image.title}
          </h3>
          <p className="text-xs text-gray-500">
            {uploaded}
            {image.size_bytes ? ` · ${formatBytes(image.size_bytes)}` : ""}
            {image.category ? ` · ${image.category}` : ""}
          </p>
        </div>

        {image.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {image.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] font-normal">
                #{tag}
              </Badge>
            ))}
            {image.tags.length > 3 && (
              <span className="text-[10px] text-gray-400">+{image.tags.length - 3}</span>
            )}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={visibilityPending || deletePending}
          aria-busy={visibilityPending}
          onClick={handleVisibility}
        >
          {visibilityPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating…
            </>
          ) : isPublic ? (
            <>
              <EyeOff className="mr-2 h-4 w-4" />
              Make private
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" />
              Make public
            </>
          )}
        </Button>

        {feedback && (
          <p
            role={feedback.type === "error" ? "alert" : "status"}
            className={`rounded-md px-2 py-1.5 text-xs ${
              feedback.type === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
            }`}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </div>
  )
}
