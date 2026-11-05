import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 12;
const DAYS = 30;

/**
 * Shown at once when the schedule is opened (or another month or version), while
 * the server loads and validates the month: the toolbar, the section filters
 * and the grid's outline.
 */
export default function ScheduleLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="size-9 rounded-md" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="size-9 rounded-md" />
        <Skeleton className="h-9 w-56 rounded-md" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {["w-20", "w-32", "w-36", "w-40", "w-28", "w-32", "w-36"].map(
          (width, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
            <Skeleton key={i} className={`h-9 rounded-full ${width}`} />
          ),
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card p-2 shadow-sm">
        <div className="flex flex-col gap-0.5">
          {Array.from({ length: ROWS }, (_, row) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder grid
            <div key={row} className="flex gap-0.5">
              <Skeleton className="h-7 w-32 shrink-0 rounded-md" />
              {Array.from({ length: DAYS }, (_, day) => (
                <Skeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder grid
                  key={day}
                  className="h-7 min-w-7 flex-1 rounded-md"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
