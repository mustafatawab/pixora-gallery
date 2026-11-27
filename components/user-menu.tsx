"use client"

import Link from "next/link"
import { useTransition } from "react"
import { Globe, LogOut, User } from "lucide-react"
import { logoutAction } from "@/actions/auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type UserMenuProps = {
  username: string
  fullName: string | null
}

export function UserMenu({ username, fullName }: UserMenuProps) {
  const [pending, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full hover:bg-gray-100" aria-label="Account menu">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-blue-100 text-blue-600">
              {username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <div className="flex flex-col space-y-1 p-2 leading-none">
          <p className="font-medium">{fullName || username}</p>
          <p className="truncate text-sm text-muted-foreground">@{username}</p>
        </div>
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/u/${username}`} className="flex items-center cursor-pointer">
            <Globe className="mr-2 h-4 w-4" />
            Public profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={pending}
          className="cursor-pointer"
          onSelect={(event) => {
            event.preventDefault()
            startTransition(() => {
              void logoutAction()
            })
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {pending ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
