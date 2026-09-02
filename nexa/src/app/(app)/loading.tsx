import { Loader2Icon } from "lucide-react";

// Next.js Suspense fallback for every route under the (app) shell that
// doesn't define its own loading.tsx — i.e. nearly all of them. Without
// this, tapping a nav item leaves the previous screen frozen with no
// feedback until the server component's data finishes loading, which reads
// as the app hanging rather than navigating.
export default function AppLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
