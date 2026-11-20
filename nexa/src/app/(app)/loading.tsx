import { Skeleton } from "@/components/ui/skeleton";

// Next.js Suspense fallback for every route under the (app) shell that doesn't define its own loading.tsx — i.e. nearly all of
// them. Without it, tapping a nav item leaves the previous screen frozen with no feedback until the server component's data
// finishes loading, which reads as the app hanging rather than navigating. Favpo look (approved mock favpo-style-loading-mock.html):
// a thin blue line that runs across the top and grey boxes where the content will be, instead of one small grey spinner.
export default function AppLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">กำลังโหลดหน้า</span>
      <div aria-hidden="true" className="gv-load-bar h-[3px] w-full overflow-hidden rounded bg-primary/20">
        <i className="block h-full w-2/5 rounded bg-primary" />
      </div>
      <Skeleton className="h-6 w-1/3 rounded" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 rounded-md" />
        <Skeleton className="h-28 rounded-md" />
        <Skeleton className="h-28 rounded-md" />
      </div>
      <Skeleton className="h-64 rounded-md" />
    </div>
  );
}
