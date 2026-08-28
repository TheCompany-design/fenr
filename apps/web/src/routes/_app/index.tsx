/**
 * / — authenticated landing page.
 *
 * Lives under the _app guard layout, so a session is guaranteed here;
 * the session arrives through the router context set by _app/route.tsx's beforeLoad.
 */
import { RocketIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview"
import { DemoForm, useDemoStore } from "@/features/demo"

/**
 * Demo query fetch — in Fenr, ALL data fetching goes through TanStack Query.
 * The loader prefetches on the server; the integration hydrates it on the client.
 */
async function fetchPosts() {
  const res = await fetch("https://jsonplaceholder.typicode.com/posts?_limit=3")
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`)
  return res.json() as Promise<Array<{ id: number; title: string }>>
}

export const Route = createFileRoute("/_app/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["posts"],
      queryFn: fetchPosts,
    }),
  component: App,
})

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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6 lg:p-8">
      {/* Header */}
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">
            Design System &amp; Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            Signed in as{" "}
            <span className="font-medium text-foreground">{user.email}</span>
          </p>
        </div>
      </header>

      {/* Dashboard Block Preview */}
      <DashboardOverview />

      {/* Architecture Integrations (State, Data Fetching, Forms) */}
      <div className="border-border border-t pt-8">
        <div className="mb-6 flex items-center gap-2">
          <HugeiconsIcon icon={RocketIcon} size={22} className="text-primary" />
          <div>
            <h2 className="font-semibold text-lg">
              Stack &amp; Architecture Tests
            </h2>
            <p className="text-muted-foreground text-xs">
              Live verification of Zustand persistence, TanStack Query SSR
              hydration, and TanStack Form
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zustand (persisted)</CardTitle>
              <CardDescription>
                Counter survives reload — state in localStorage.
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
              <CardTitle className="text-base">TanStack Query (SSR)</CardTitle>
              <CardDescription>
                Prefetched by loader, hydrated on client.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {posts.map((post) => (
                <p key={post.id} className="text-xs leading-snug">
                  <span className="text-muted-foreground font-mono">
                    #{post.id}
                  </span>{" "}
                  {post.title}
                </p>
              ))}
            </CardContent>
          </Card>

          <div className="md:col-span-2 xl:col-span-1">
            <DemoForm />
          </div>
        </div>
      </div>
    </div>
  )
}
