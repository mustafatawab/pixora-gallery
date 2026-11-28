import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getCurrentProfile } from "@/lib/auth/current-user"
import { getGalleryImages } from "@/lib/services/images"
import { getProfileByUsername } from "@/lib/services/profiles"
import { GalleryImageCard } from "@/components/gallery/gallery-image-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

type PublicProfilePageProps = {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfileByUsername(username)

  if (!profile) return { title: "Profile not found" }

  const name = profile.full_name || profile.username
  return {
    title: `${name} (@${profile.username})`,
    description: profile.bio || `Photography by @${profile.username} on Pixora.`,
  }
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params
  const profile = await getProfileByUsername(username)

  if (!profile) notFound()

  const [gallery, viewer] = await Promise.all([getGalleryImages(profile.id), getCurrentProfile()])
  const isOwner = viewer?.id === profile.id

  const images = [...gallery.publicImages, ...gallery.privateImages].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )
  const publicCount = gallery.publicImages.length
  const privateCount = gallery.privateImages.length
  const shownCount = isOwner ? images.length : publicCount

  const displayName = profile.full_name || profile.username
  const joined = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })

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
                <span>
                  {shownCount} photograph{shownCount === 1 ? "" : "s"}
                </span>
                {isOwner && privateCount > 0 && <span>{privateCount} private</span>}
                <span>Joined {joined}</span>
              </div>
            </div>
          </div>

          {isOwner && (
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/profile">Dashboard</Link>
              </Button>
              <Button asChild>
                <Link href="/upload">Upload</Link>
              </Button>
            </div>
          )}
        </div>

        {isOwner && (
          <p className="mt-6 border-l-2 border-brand pl-3 text-xs leading-relaxed text-muted-foreground">
            You&apos;re viewing your public profile. Private photographs are marked and visible only to you.
          </p>
        )}
      </header>

      <section className="py-10 lg:py-14">
        {images.length === 0 ? (
          <div className="flex min-h-[34vh] flex-col justify-center border-b border-line">
            <p className="max-w-md font-serif text-3xl leading-tight text-ink">
              {isOwner ? "Your gallery is still empty." : "No photographs yet."}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {isOwner
                ? "Upload your first photograph and choose whether it is public or private."
                : `@${profile.username} hasn't published any photographs.`}
            </p>
            {isOwner && (
              <Button asChild className="mt-6 w-fit">
                <Link href="/upload">Upload a photograph</Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-5">
              <h2 className="font-serif text-2xl leading-none text-ink">
                {isOwner ? "All photographs" : "Public gallery"}
              </h2>
              <span className="text-xs text-muted-foreground">
                {isOwner ? `${images.length} total` : `${publicCount} photograph${publicCount === 1 ? "" : "s"}`}
              </span>
            </div>

            <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">
              {images.map((image, index) => (
                <GalleryImageCard
                  key={image.id}
                  image={image}
                  owner={profile}
                  showVisibility={isOwner}
                  priority={index === 0}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
