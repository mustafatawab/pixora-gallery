/** Categories offered on upload and used for feed filtering. */
export const IMAGE_CATEGORIES = [
  "nature",
  "portrait",
  "street",
  "architecture",
  "abstract",
  "wildlife",
  "landscape",
  "macro",
  "travel",
  "fashion",
  "lifestyle",
] as const

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number]

export function isImageCategory(value: string): value is ImageCategory {
  return (IMAGE_CATEGORIES as readonly string[]).includes(value)
}

export function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}
