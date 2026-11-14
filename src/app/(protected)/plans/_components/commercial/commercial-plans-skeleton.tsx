import { Skeleton } from "../../../_ui/skeleton";

export function CommercialPlansSkeleton() {
  return (
    <section
      role="status"
      aria-busy="true"
      aria-label="Carregando contratação por empresa"
      className="flex flex-col gap-5"
    >
      <Skeleton className="h-7 w-64" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </section>
  );
}
