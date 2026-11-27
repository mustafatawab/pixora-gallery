"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, ImageIcon, Loader2, Upload, X } from "lucide-react"
import { createImageAction } from "@/actions/images"
import { IMAGE_CATEGORIES } from "@/lib/constants/categories"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Images</h1>
          <p className="text-gray-600">
            Share your photography as @{profile.username}. Uploads go straight to your private folder in Supabase
            Storage.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Image details</CardTitle>
                <CardDescription>
                  Choose files, add details, then send them to your gallery. Private is the default.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpload} className="space-y-6" noValidate>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Images *</Label>
                      <span className="text-xs text-gray-500">
                        JPEG, PNG, WebP or AVIF · up to 50 MB each
                      </span>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Add images"
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
                      className={`border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer ${
                        dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 bg-white"
                      } ${items.length === 0 ? "p-12" : "p-6"}`}
                    >
                      <Upload className={`mx-auto text-gray-400 mb-3 ${items.length === 0 ? "h-14 w-14" : "h-8 w-8"}`} />
                      <p className="text-blue-600 font-medium">
                        {items.length === 0 ? "Click to upload" : "Add more images"}
                        <span className="text-gray-600 font-normal"> or drag and drop</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {items.length === 0
                          ? "You can select multiple images at once"
                          : `${items.length} selected · click to add more`}
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {items.map((item) => {
                          const canRemove = item.status === "ready" || item.status === "error"
                          return (
                            <div key={item.id} className="relative overflow-hidden rounded-lg border bg-white">
                              <div className="aspect-square relative bg-gray-100">
                                <Image
                                  src={item.previewUrl}
                                  alt={item.file.name}
                                  fill
                                  unoptimized
                                  sizes="(max-width: 640px) 50vw, 200px"
                                  className="object-cover"
                                />
                                {(item.preparing || item.status === "uploading" || item.status === "saving") && (
                                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-xs gap-2">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                    {statusLabel(item)}
                                  </div>
                                )}
                                {canRemove && !submitting && (
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-2 right-2 h-7 w-7 rounded-full p-0"
                                    onClick={() => removeItem(item)}
                                    aria-label={`Remove ${item.file.name}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                              <div className="p-2 space-y-1">
                                <p className="truncate text-xs font-medium text-gray-900">{item.file.name}</p>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[11px] text-gray-500">{formatBytes(item.file.size)}</span>
                                  {item.status === "done" ? (
                                    <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-700">
                                      Uploaded
                                    </Badge>
                                  ) : item.status === "error" ? (
                                    <Badge variant="destructive" className="text-[10px]">
                                      Failed
                                    </Badge>
                                  ) : null}
                                </div>
                                {item.status === "error" && item.error && (
                                  <p className="text-[11px] text-red-600 line-clamp-2" title={item.error}>
                                    {item.error}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={form.title}
                        onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                        placeholder="Enter a title"
                        maxLength={200}
                        required
                        aria-invalid={Boolean(fieldErrors.title)}
                        disabled={submitting}
                      />
                      {fieldErrors.title && <p className="text-xs text-red-600">{fieldErrors.title}</p>}
                      {items.length > 1 && !fieldErrors.title && (
                        <p className="text-xs text-gray-500">
                          Numbering is added automatically for multiple images.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <select
                        id="category"
                        value={form.category}
                        onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                        disabled={submitting}
                      >
                        {IMAGE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={form.description}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, description: event.target.value }))
                      }
                      placeholder="Describe the images, the story behind them, or technical details…"
                      rows={4}
                      maxLength={2000}
                      aria-invalid={Boolean(fieldErrors.description)}
                      disabled={submitting}
                    />
                    {fieldErrors.description && <p className="text-xs text-red-600">{fieldErrors.description}</p>}
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
                    {fieldErrors.tags && <p className="text-xs text-red-600">{fieldErrors.tags}</p>}
                    {tagList.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tagList.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                    <div className="space-y-1">
                      <Label htmlFor="visibility" className="cursor-pointer">
                        Make images public
                      </Label>
                      <p className="text-sm text-gray-500">
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

                  {formError && (
                    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                      {formError}
                    </p>
                  )}
                  {notice && (
                    <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {notice}
                    </p>
                  )}

                  {submitting && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Uploading images…</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="w-full" />
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting || isPreparing || items.length === 0 || pendingItems.length === 0}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading…
                      </>
                    ) : isPreparing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Preparing previews…
                      </>
                    ) : (
                      `Upload ${pendingItems.length} Image${pendingItems.length === 1 ? "" : "s"}`
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ImageIcon className="h-5 w-5 mr-2" />
                  Upload tips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-1">Quality</h4>
                  <p className="text-gray-600">Upload high-resolution files for the best viewing experience.</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Formats</h4>
                  <p className="text-gray-600">JPEG, PNG, WebP and AVIF. Maximum 50 MB per image.</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Privacy</h4>
                  <p className="text-gray-600">
                    Images are private by default. Public galleries use a web-optimized preview generated in your
                    browser, so metadata such as GPS location is not published.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Tags</h4>
                  <p className="text-gray-600">Add up to 10 tags so people can discover your work.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How it works</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span className="text-gray-600">Files upload directly from your browser to Storage.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <span className="text-gray-600">Your session and RLS enforce that only you can write to your folder.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ImageIcon className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                    <span className="text-gray-600">Image details are saved after the file is verified.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
