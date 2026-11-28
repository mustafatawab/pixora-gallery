"use client"

import Link from "next/link"
import { useEffect, useActionState } from "react"
import { useRouter } from "next/navigation"
import { updateProfileAction } from "@/actions/auth"
import { initialFormState } from "@/lib/auth/form-state"
import type { OwnerImage, Profile } from "@/lib/types/domain"
import { ProfileImageCard } from "@/components/profile/profile-image-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type ProfileViewProps = {
  profile: Profile
  images: { publicImages: OwnerImage[]; privateImages: OwnerImage[] }
  initialTab?: "public" | "private" | "settings"
}

export function ProfileView({ profile, images, initialTab = "public" }: ProfileViewProps) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialFormState)
  const router = useRouter()

  useEffect(() => {
    if (state.status === "success") router.refresh()
  }, [state.status, router])

  const displayName = profile.full_name || profile.username
  const joined = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })
  const publicCount = images.publicImages.length
  const privateCount = images.privateImages.length

  return (
    <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
      <header className="border-b border-line py-10 lg:py-14">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20 border border-line sm:h-24 sm:w-24">
              <AvatarFallback className="bg-ink font-serif text-3xl text-paper">
                {profile.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div>
              <h1 className="font-serif text-4xl leading-[1.02] tracking-[-0.03em] text-ink sm:text-5xl">
                {displayName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">@{profile.username}</p>
              {profile.bio && <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink/75">{profile.bio}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span>{publicCount + privateCount} photographs</span>
                <span>{publicCount} public</span>
                <span>Joined {joined}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={`/u/${profile.username}`}>Public profile</Link>
            </Button>
            <Button asChild>
              <Link href="/upload">Upload</Link>
            </Button>
          </div>
        </div>
      </header>

      <Tabs defaultValue={initialTab} className="mt-8 pb-16">
        <TabsList className="flex h-auto w-full justify-start gap-6 rounded-none border-b border-line bg-transparent p-0">
          <TabsTrigger
            value="public"
            className="relative -mb-px rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 text-sm font-medium text-muted-foreground transition-colors hover:text-ink data-[state=active]:border-ink data-[state=active]:bg-transparent data-[state=active]:text-ink data-[state=active]:shadow-none"
          >
            Public <span className="ml-1 text-muted-foreground">({publicCount})</span>
          </TabsTrigger>
          <TabsTrigger
            value="private"
            className="relative -mb-px rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 text-sm font-medium text-muted-foreground transition-colors hover:text-ink data-[state=active]:border-ink data-[state=active]:bg-transparent data-[state=active]:text-ink data-[state=active]:shadow-none"
          >
            Private <span className="ml-1 text-muted-foreground">({privateCount})</span>
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="relative -mb-px rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 text-sm font-medium text-muted-foreground transition-colors hover:text-ink data-[state=active]:border-ink data-[state=active]:bg-transparent data-[state=active]:text-ink data-[state=active]:shadow-none"
          >
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="public" className="mt-9">
          <h2 className="sr-only">Public photographs</h2>
          <ImageGallery
            images={images.publicImages}
            emptyTitle="Nothing public yet."
            emptyDescription="Photographs you publish appear here and in the public gallery."
          />
        </TabsContent>

        <TabsContent value="private" className="mt-9">
          <h2 className="sr-only">Private photographs</h2>
          <ImageGallery
            images={images.privateImages}
            emptyTitle="Your private archive is empty."
            emptyDescription="Private photographs are visible only to you. New uploads are private by default."
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-9">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr]">
            <section>
              <h2 className="font-serif text-2xl leading-none text-ink">Profile details</h2>
              <p className="mt-2 text-sm text-muted-foreground">These appear on your public profile.</p>

              <form action={formAction} className="mt-6 space-y-5" noValidate>
                {state.status === "success" && (
                  <p role="status" className="border-l-2 border-brand pl-3 text-sm leading-relaxed text-ink">
                    {state.message}
                  </p>
                )}
                {state.status === "error" && state.message && (
                  <p role="alert" className="border-l-2 border-destructive pl-3 text-sm leading-relaxed text-destructive">
                    {state.message}
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    defaultValue={profile.full_name ?? ""}
                    aria-invalid={Boolean(state.fieldErrors?.fullName)}
                  />
                  {state.fieldErrors?.fullName && (
                    <p className="text-xs text-destructive">{state.fieldErrors.fullName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    defaultValue={profile.username}
                    aria-invalid={Boolean(state.fieldErrors?.username)}
                  />
                  {state.fieldErrors?.username && (
                    <p className="text-xs text-destructive">{state.fieldErrors.username}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    name="bio"
                    defaultValue={profile.bio ?? ""}
                    placeholder="Tell people about your photography…"
                    rows={4}
                    aria-invalid={Boolean(state.fieldErrors?.bio)}
                  />
                  {state.fieldErrors?.bio && <p className="text-xs text-destructive">{state.fieldErrors.bio}</p>}
                </div>

                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save changes"}
                </Button>
              </form>
            </section>

            <aside className="border-t border-line pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <h2 className="font-serif text-2xl leading-none text-ink">Visibility</h2>
              <dl className="mt-5 divide-y divide-line border-y border-line text-sm">
                <div className="py-4">
                  <dt className="font-medium text-ink">Public</dt>
                  <dd className="mt-1 leading-relaxed text-muted-foreground">
                    Listed in the gallery and visible to anyone with the link.
                  </dd>
                </div>
                <div className="py-4">
                  <dt className="font-medium text-ink">Private</dt>
                  <dd className="mt-1 leading-relaxed text-muted-foreground">
                    Visible only to you, served through short-lived signed links.
                  </dd>
                </div>
                <div className="py-4">
                  <dt className="font-medium text-ink">Changing later</dt>
                  <dd className="mt-1 leading-relaxed text-muted-foreground">
                    Use the visibility control on any photograph in your dashboard.
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ImageGallery({
  images,
  emptyTitle,
  emptyDescription,
}: {
  images: OwnerImage[]
  emptyTitle: string
  emptyDescription: string
}) {
  if (images.length === 0) {
    return <EmptyGallery title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">
      {images.map((image) => (
        <ProfileImageCard key={image.id} image={image} />
      ))}
    </div>
  )
}

function EmptyGallery({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[34vh] flex-col justify-center border-b border-line py-12">
      <p className="max-w-md font-serif text-3xl leading-tight text-ink">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      <Button asChild variant="outline" className="mt-6 w-fit">
        <Link href="/upload">Upload a photograph</Link>
      </Button>
    </div>
  )
}
