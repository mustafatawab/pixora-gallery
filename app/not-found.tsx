import Link from "next/link"
import { Camera } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <Camera className="mb-4 h-16 w-16 text-gray-400" />
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Page not found</h1>
      <p className="mb-6 max-w-md text-gray-600">
        The page you are looking for doesn&apos;t exist, or the photographer has not published a profile here.
      </p>
      <Button asChild>
        <Link href="/">Back to the gallery</Link>
      </Button>
    </div>
  )
}
