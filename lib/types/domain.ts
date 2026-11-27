import type { Database } from "@/lib/types/database"

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type ImageRecord = Database["public"]["Tables"]["images"]["Row"]
export type ImageVisibility = Database["public"]["Enums"]["image_visibility"]

/** An image row plus a freshly minted, short-lived signed preview URL. */
export type OwnerImage = ImageRecord & { signedUrl: string | null }

/** Public fields needed to attribute an image to its owner. */
export type PublicProfile = Pick<Profile, "id" | "username" | "full_name" | "bio" | "avatar_path">

/** A public-feed image with the owner fields needed by the gallery card. */
export type FeedImage = OwnerImage & { owner: PublicProfile }

export type ImageActionResult =
  | { ok: true; imageId?: string; visibility?: ImageVisibility; warning?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
