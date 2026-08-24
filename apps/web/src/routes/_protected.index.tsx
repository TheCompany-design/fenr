/**
 * / — authenticated landing page.
 *
 * Lives under the _protected guard layout, so a session is guaranteed here;
 * the session arrives through the router context set by _protected.beforeLoad.
 */
import { RocketIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { toast } from "sonner"

import { DemoForm } from "@/components/demo-form"
import { signOut } from "@/lib/auth-client"
import { useDemoStore } from "@/lib/stores/demo-store"

/**
 * Demo query fetch — in Fenr, ALL data fetching goes through TanStack Query.
 * The loader prefetches on the server; the integration hydrates it on the client.
 */
async function fetchPosts() {
  const res = await fetch("https://jsonplaceholder.typicode.com/posts?_limit=3")
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`)
  return res.json() as Promise<Array<{ id: number; title: string }>>
}

export const Route = createFileRoute("/_protected/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["posts"],
      queryFn: fetchPosts,
    }),
  component: App,
})

function SignOutButton() {
  const navigate = useNavigate()
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        const { error } = await signOut()
        if (error) {
          toast.error("Sign-out failed", { description: "Please try again." })
          return
        }
        await navigate({ to: "/auth/sign-in" })
      }}
    >
      Sign out
    </Button>
  )
}

function App() {
  const { session } = Route.useRouteContext()
  const user = session.user

  const { data: posts } = useSuspenseQuery({
    queryKey: ["posts"],
    queryFn: fetchPosts,
  })

  const count = useDemoStore((s) => s.count)
  const increment = useDemoStore((s) => s.increment)
  const decrement = useDemoStore((s) => s.decrement)
  const reset = useDemoStore((s) => s.reset)

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-center gap-3">
        <HugeiconsIcon icon={RocketIcon} size={28} className="text-primary" />
        <div className="flex-1">
          <h1 className="font-semibold text-2xl">Fenr</h1>
          <p className="text-muted-foreground text-sm">
            Signed in as <span className="text-foreground">{user.email}</span>
          </p>
        </div>
        <SignOutButton />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Zustand (persisted)</CardTitle>
          <CardDescription>
            Counter survives a full page reload — state lives in localStorage.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={decrement}>
            −
          </Button>
          <Badge variant="secondary">{count}</Badge>
          <Button variant="outline" size="icon" onClick={increment}>
            +
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TanStack Query (SSR-hydrated)</CardTitle>
          <CardDescription>
            Prefetched by the route loader on the server, streamed &amp;
            hydrated on the client.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {posts.map((post) => (
            <p key={post.id} className="leading-snug">
              <span className="text-muted-foreground">#{post.id}</span>{" "}
              {post.title}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auth stack</CardTitle>
          <CardDescription>
            This page is guarded by the _protected layout — sessions live in
            Postgres via Drizzle (@workspace/database).
          </CardDescription>
        </CardHeader>
      </Card>

      <DemoForm />
    </main>
  )
}
