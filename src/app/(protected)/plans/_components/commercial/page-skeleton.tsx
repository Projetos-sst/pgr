import { Skeleton } from "../../../_ui/skeleton";

export function PageSkeleton({ label }: { label: string }) {
  return (
    <section
      role="status"
      aria-busy="true"
      aria-label={label}
      className="flex flex-col gap-4"
    >
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </section>
  );
}
