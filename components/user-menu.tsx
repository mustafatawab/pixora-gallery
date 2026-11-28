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
        <Button
          variant="ghost"
          className="h-9 w-9 rounded-none p-0 hover:bg-transparent"
          aria-label="Account menu"
        >
          <Avatar className="h-9 w-9 rounded-none border border-line">
            <AvatarFallback className="rounded-none bg-ink font-serif text-sm text-paper">
              {username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-60 rounded-none border-line bg-card p-0 shadow-[0_18px_50px_rgba(17,17,16,0.16)]"
        align="end"
        forceMount
      >
        <div className="border-b border-line px-4 py-3">
          <p className="font-serif text-lg leading-tight text-ink">{fullName || username}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">@{username}</p>
        </div>
        <div className="p-1">
          <DropdownMenuItem asChild className="cursor-pointer rounded-none px-3 py-2.5 text-sm focus:bg-accent">
            <Link href="/profile" className="flex items-center">
              <User className="mr-2.5 h-4 w-4" />
              Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer rounded-none px-3 py-2.5 text-sm focus:bg-accent">
            <Link href={`/u/${username}`} className="flex items-center">
              <Globe className="mr-2.5 h-4 w-4" />
              Public profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending}
            className="cursor-pointer rounded-none px-3 py-2.5 text-sm focus:bg-accent"
            onSelect={(event) => {
              event.preventDefault()
              startTransition(() => {
                void logoutAction()
              })
            }}
          >
            <LogOut className="mr-2.5 h-4 w-4" />
            {pending ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
