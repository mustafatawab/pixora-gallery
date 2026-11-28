"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ChevronDown, ImagePlus, Loader2, X } from "lucide-react"
import { createImageAction } from "@/actions/images"
import { IMAGE_CATEGORIES, categoryLabel } from "@/lib/constants/categories"
import { createClient } from "@/lib/supabase/client"
import {
  buildImagePath,
  buildThumbnailPath,
  formatBytes,
  IMAGE_MIME_TYPES,
  isAllowedImageMime,
  MAX_IMAGE_BYTES,
  type ThumbnailMime,
} from "@/lib/storage/paths"
import { prepareImageForUpload } from "@/lib/storage/thumbnails"
import type { ImageVisibility, Profile } from "@/lib/types/domain"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

type UploadStatus = "ready" | "uploading" | "saving" | "done" | "error"

type UploadItem = {
  id: string
  file: File
  previewUrl: string
  status: UploadStatus
  error?: string
  width: number | null
  height: number | null
  /** Metadata-free preview generated in the browser before upload. */
  thumbnail: Blob | null
  thumbnailMime: ThumbnailMime | null
  preparing: boolean
}

type UploadFormProps = {
  profile: Profile
}

function parseTagInput(value: string): string[] {
  const seen = new Set<string>()
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => {
      if (!tag) return false
      const key = tag.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function statusLabel(item: UploadItem): string {
  if (item.preparing) return "Preparing preview…"

  switch (item.status) {
    case "uploading":
      return "Uploading…"
    case "saving":
      return "Saving details…"
    case "done":
      return "Uploaded"
    case "error":
      return item.error ?? "Upload failed"
    default:
      return "Ready"
  }
}

function prepareErrorMessage(error: unknown): string {
  console.error("[upload] could not prepare an image preview", error)
  return "This image couldn't be prepared for the web. Try a JPEG, PNG, WebP, or AVIF file."
}

function mapUploadError(message: string): string {
  if (/exceeded the maximum allowed size|too large|payload/i.test(message)) {
    return "This image is over the 50 MB limit."
  }
  if (/mime|content type|not allowed/i.test(message)) {
    return "That file type isn't supported."
  }
  if (/already exists/i.test(message)) {
    return "This file already exists. Remove it and choose it again."
  }
  if (/row-level security|permission|unauthorized|jwt/i.test(message)) {
    return "You don't have permission to upload this file. Sign in again and retry."
  }
  return "Upload failed. Please try again."
}

export function UploadForm({ profile }: UploadFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef<UploadItem[]>([])

  const [items, setItems] = useState<UploadItem[]>([])
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "nature",
    tags: "",
    visibility: "private" as ImageVisibility,
  })
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Object URLs must be revoked or they keep the full image in memory.
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    }
  }, [])

  const tagList = useMemo(() => parseTagInput(form.tags), [form.tags])
  const pendingItems = items.filter((item) => item.status === "ready" || item.status === "error")
  const isPreparing = items.some((item) => item.preparing)

  const addFiles = (fileList: File[]) => {
    if (fileList.length === 0) return

    const accepted: UploadItem[] = []
    const rejected: string[] = []

    for (const file of fileList) {
      if (!isAllowedImageMime(file.type)) {
        rejected.push(`${file.name}: unsupported file type`)
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        rejected.push(`${file.name}: ${formatBytes(file.size)} is over the 50 MB limit`)
        continue
      }

      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "ready",
        width: null,
        height: null,
        thumbnail: null,
        thumbnailMime: null,
        preparing: true,
      })
    }

    if (accepted.length > 0) {
      setItems((previous) => [...previous, ...accepted])
      setFormError(null)
    }

    setNotice(rejected.length > 0 ? rejected.join(" · ") : null)

    for (const item of accepted) {
      void prepareImageForUpload(item.file)
        .then((prepared) => {
          updateItem(item.id, {
            width: prepared.width,
            height: prepared.height,
            thumbnail: prepared.thumbnail,
            thumbnailMime: prepared.thumbnailMime,
            preparing: false,
          })
        })
        .catch((error: unknown) => {
          updateItem(item.id, {
            status: "error",
            error: prepareErrorMessage(error),
            preparing: false,
          })
        })
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    addFiles(files)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    addFiles(Array.from(event.dataTransfer.files))
  }

  const removeItem = (item: UploadItem) => {
    if (item.status === "uploading" || item.status === "saving" || item.status === "done") return
    URL.revokeObjectURL(item.previewUrl)
    setItems((previous) => previous.filter((current) => current.id !== item.id))
  }

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    const title = form.title.trim()

    if (!title) errors.title = "Title is required."
    if (title.length > 200) errors.title = "Title must be 200 characters or fewer."
    if (form.description.trim().length > 2000) errors.description = "Description must be 2000 characters or fewer."
    if (tagList.length > 10) errors.tags = "Use at most 10 tags."
    if (tagList.some((tag) => tag.length > 30)) errors.tags = "Each tag must be 30 characters or fewer."

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    setFormError(null)
    setNotice(null)

    if (isPreparing) {
      setFormError("Wait for the image previews to finish generating, then try again.")
      return
    }

    const pending = items.filter((item) => item.status === "ready" || item.status === "error")
    if (pending.length === 0) {
      setFormError(items.length === 0 ? "Choose at least one image to upload." : "All selected images are uploaded.")
      return
    }

    if (!validate()) return

    const title = form.title.trim()
    const description = form.description.trim()
    const category = form.category
    const visibility = form.visibility
    const tags = tagList

    setSubmitting(true)
    setProgress(0)

    let failures = 0

    for (const [index, item] of pending.entries()) {
      const itemIndex = items.findIndex((candidate) => candidate.id === item.id)
      const finalTitle =
        items.length === 1
          ? title
          : `${title.slice(0, 190).trimEnd()} ${itemIndex >= 0 ? itemIndex + 1 : index + 1}`

      let preparedThumbnail: { blob: Blob; mime: ThumbnailMime } | null =
        item.thumbnail && item.thumbnailMime ? { blob: item.thumbnail, mime: item.thumbnailMime } : null

      // Retry preparation for items whose first attempt failed or was removed.
      if (!preparedThumbnail) {
        try {
          const prepared = await prepareImageForUpload(item.file)
          preparedThumbnail = { blob: prepared.thumbnail, mime: prepared.thumbnailMime }
          updateItem(item.id, {
            width: prepared.width,
            height: prepared.height,
            thumbnail: prepared.thumbnail,
            thumbnailMime: prepared.thumbnailMime,
            preparing: false,
          })
        } catch (error) {
          failures += 1
          updateItem(item.id, { status: "error", error: prepareErrorMessage(error), preparing: false })
          continue
        }
      }

      const thumbnail = preparedThumbnail.blob
      const thumbnailMime = preparedThumbnail.mime

      let path: string | null = null
      let thumbnailPath: string | null = null

      try {
        path = buildImagePath(profile.id, item.id, item.file.type)
        thumbnailPath = buildThumbnailPath(profile.id, item.id, thumbnailMime)
      } catch {
        failures += 1
        updateItem(item.id, { status: "error", error: "Invalid file type." })
        continue
      }

      updateItem(item.id, { status: "uploading", error: undefined })

      try {
        const { error: uploadError } = await supabase.storage.from("media").upload(path, item.file, {
          contentType: item.file.type,
          cacheControl: "3600",
          upsert: true,
        })

        if (uploadError) {
          failures += 1
          updateItem(item.id, { status: "error", error: mapUploadError(uploadError.message) })
          continue
        }

        const { error: thumbnailUploadError } = await supabase.storage.from("media").upload(thumbnailPath, thumbnail, {
          contentType: thumbnailMime,
          cacheControl: "31536000",
          upsert: true,
        })

        if (thumbnailUploadError) {
          failures += 1
          await supabase.storage.from("media").remove([path])
          updateItem(item.id, { status: "error", error: mapUploadError(thumbnailUploadError.message) })
          continue
        }

        updateItem(item.id, { status: "saving" })

        const result = await createImageAction({
          id: item.id,
          mimeType: item.file.type,
          thumbnailMimeType: thumbnailMime,
          title: finalTitle,
          description,
          category,
          tags,
          visibility,
          width: item.width,
          height: item.height,
        })

        if (!result.ok) {
          failures += 1
          const { error: cleanupError } = await supabase.storage.from("media").remove([path, thumbnailPath])
          if (cleanupError) {
            console.error("[upload] could not remove objects after a metadata failure", cleanupError.message)
          }
          updateItem(item.id, { status: "error", error: result.error })
          continue
        }

        updateItem(item.id, { status: "done" })
      } catch (error) {
        failures += 1
        console.error("[upload] failed", error)

        // Do not delete here: the action may have saved the row before the
        // response was lost. An object without a row is removed by the daily
        // cleanup job, whereas a row without an object would be a broken image.
        updateItem(item.id, { status: "error", error: "Upload failed. Please try again." })
      } finally {
        setProgress(Math.round(((index + 1) / pending.length) * 100))
      }
    }

    setSubmitting(false)

    if (failures === 0) {
      router.push(`/profile?tab=${visibility}`)
      return
    }

    setFormError(
      `${failures} image${failures === 1 ? "" : "s"} could not be uploaded. Fix or remove the failed item${
        failures === 1 ? "" : "s"
      } and try again.`,
    )
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:py-14">
      <header className="border-b border-line pb-8">
        <h1 className="max-w-[16ch] font-serif text-4xl leading-[1.02] tracking-[-0.03em] text-ink sm:text-5xl">
          Add to your archive.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Uploading as <span className="text-ink">@{profile.username}</span>. Files go straight to your private folder,
          and web previews are generated in your browser.
        </p>
      </header>

      <form onSubmit={handleUpload} className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-14" noValidate>
        <div className="space-y-10 lg:col-span-8">
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-serif text-2xl leading-none text-ink">Photographs</h2>
              <span className="text-xs text-muted-foreground">JPEG, PNG, WebP, AVIF · 50 MB each</span>
            </div>

            <div
              role="button"
              tabIndex={0}
              aria-label="Add photographs"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "mt-4 flex cursor-pointer flex-col items-center justify-center border border-dashed px-6 text-center transition-colors",
                dragging ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-ink",
                items.length === 0 ? "py-16" : "py-9",
              )}
            >
              <ImagePlus className="h-8 w-8 text-muted-foreground" strokeWidth={1.25} aria-hidden="true" />
              <p className="mt-4 text-sm font-medium text-ink">
                {items.length === 0 ? "Choose photographs" : "Add more photographs"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Drag files here, or click to browse. Select several at once.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={IMAGE_MIME_TYPES.join(",")}
                multiple
                onChange={handleFileSelect}
                className="sr-only"
                tabIndex={-1}
              />
            </div>

            {items.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((item) => {
                  const canRemove = item.status === "ready" || item.status === "error"
                  const busy = item.preparing || item.status === "uploading" || item.status === "saving"

                  return (
                    <div key={item.id} className="border border-line bg-card">
                      <div className="relative aspect-square overflow-hidden bg-line/40">
                        <Image
                          src={item.previewUrl}
                          alt={item.file.name}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 50vw, 240px"
                          className="object-cover"
                        />

                        {busy && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/70 px-2 text-center text-[11px] text-paper">
                            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                            {statusLabel(item)}
                          </div>
                        )}

                        {canRemove && !submitting && (
                          <button
                            type="button"
                            onClick={() => removeItem(item)}
                            aria-label={`Remove ${item.file.name}`}
                            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center bg-paper/90 text-ink transition-colors hover:bg-destructive hover:text-paper"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5 p-2.5">
                        <p className="truncate text-xs font-medium text-ink" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">{formatBytes(item.file.size)}</span>
                          {item.status === "done" ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Uploaded
                            </Badge>
                          ) : item.status === "error" ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Failed
                            </Badge>
                          ) : null}
                        </div>
                        {item.status === "error" && item.error && (
                          <p className="line-clamp-2 text-[11px] leading-snug text-destructive" title={item.error}>
                            {item.error}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="border-t border-line pt-8">
            <h2 className="font-serif text-2xl leading-none text-ink">Details</h2>

            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                    placeholder="Name this photograph"
                    maxLength={200}
                    required
                    aria-invalid={Boolean(fieldErrors.title)}
                    disabled={submitting}
                  />
                  {fieldErrors.title && <p className="text-xs text-destructive">{fieldErrors.title}</p>}
                  {items.length > 1 && !fieldErrors.title && (
                    <p className="text-xs text-muted-foreground">
                      A number is added to each title for multi-image uploads.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <div className="relative">
                    <select
                      id="category"
                      value={form.category}
                      onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value }))}
                      className="h-11 w-full appearance-none border border-line bg-card px-3.5 pr-9 text-[15px] text-ink transition-colors focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={submitting}
                    >
                      {IMAGE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {categoryLabel(category)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                  placeholder="Describe the images, the story behind them, or technical details…"
                  rows={4}
                  maxLength={2000}
                  aria-invalid={Boolean(fieldErrors.description)}
                  disabled={submitting}
                />
                {fieldErrors.description && <p className="text-xs text-destructive">{fieldErrors.description}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={form.tags}
                  onChange={(event) => setForm((previous) => ({ ...previous, tags: event.target.value }))}
                  placeholder="nature, landscape, sunset (comma separated, max 10)"
                  aria-invalid={Boolean(fieldErrors.tags)}
                  disabled={submitting}
                />
                {fieldErrors.tags && <p className="text-xs text-destructive">{fieldErrors.tags}</p>}
                {tagList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tagList.map((tag) => (
                      <Badge key={tag} variant="outline">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="border-t border-line pt-8">
            <div className="flex items-start justify-between gap-6 border border-line bg-card p-5">
              <div>
                <Label htmlFor="visibility" className="cursor-pointer text-sm text-ink">
                  Publish to the public gallery
                </Label>
                <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {form.visibility === "public"
                    ? "Anyone can view these images. They will appear in the public gallery."
                    : "Only you can see these images. You can make them public later."}
                </p>
              </div>
              <Switch
                id="visibility"
                checked={form.visibility === "public"}
                onCheckedChange={(checked) =>
                  setForm((previous) => ({ ...previous, visibility: checked ? "public" : "private" }))
                }
                disabled={submitting}
              />
            </div>
          </section>

          {formError && (
            <p role="alert" className="border-l-2 border-destructive pl-3 text-sm leading-relaxed text-destructive">
              {formError}
            </p>
          )}
          {notice && (
            <p role="status" className="border-l-2 border-line pl-3 text-sm leading-relaxed text-muted-foreground">
              {notice}
            </p>
          )}

          {submitting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Uploading images…</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto sm:min-w-[240px]"
            disabled={submitting || isPreparing || items.length === 0 || pendingItems.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Uploading…
              </>
            ) : isPreparing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Preparing previews…
              </>
            ) : (
              `Upload ${pendingItems.length} image${pendingItems.length === 1 ? "" : "s"}`
            )}
          </Button>
        </div>

        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <h2 className="font-serif text-2xl leading-none text-ink">Before you publish</h2>

            <dl className="mt-5 divide-y divide-line border-y border-line text-sm">
              <div className="py-4">
                <dt className="font-medium text-ink">Formats</dt>
                <dd className="mt-1 leading-relaxed text-muted-foreground">
                  JPEG, PNG, WebP or AVIF. Up to 50 MB per file.
                </dd>
              </div>
              <div className="py-4">
                <dt className="font-medium text-ink">Privacy</dt>
                <dd className="mt-1 leading-relaxed text-muted-foreground">
                  Uploads are private by default. Turn on the public switch when you&apos;re ready to share.
                </dd>
              </div>
              <div className="py-4">
                <dt className="font-medium text-ink">Metadata</dt>
                <dd className="mt-1 leading-relaxed text-muted-foreground">
                  Public galleries use a preview generated in your browser. Location data is stripped before anything
                  is shared.
                </dd>
              </div>
              <div className="py-4">
                <dt className="font-medium text-ink">Tags</dt>
                <dd className="mt-1 leading-relaxed text-muted-foreground">
                  Add up to 10 tags so people can find your work.
                </dd>
              </div>
            </dl>

            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              Files upload directly from your browser to storage. Your session and row-level security keep writes
              limited to your own folder.
            </p>
          </div>
        </aside>
      </form>
    </div>
  )
}
