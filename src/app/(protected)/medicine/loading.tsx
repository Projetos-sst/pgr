import { Skeleton } from "../_ui/skeleton";

/**
 * Esqueleto do painel enquanto o servidor monta os números. Os blocos são
 * decorativos (`aria-hidden` no `Skeleton`); quem anuncia a espera é o container
 * `role="status"` com o texto `sr-only`.
 */
export default function MedicineLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-[22px] px-4 pt-8 pb-10 sm:px-[30px]"
    >
      <span className="sr-only">Carregando painel da Medicina</span>

      <div className="flex items-center gap-3.5">
        <Skeleton className="h-[50px] w-[50px] rounded-[15px]" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-56 max-w-[60vw]" />
          <Skeleton className="h-3 w-72 max-w-[70vw]" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="glass-card flex flex-col gap-4 p-[20px]">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-16 rounded-xl" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="glass-card overflow-hidden rounded-[20px]">
        <div className="flex flex-wrap gap-3.5 border-b border-black/5 p-[18px_20px]">
          <Skeleton className="h-11 w-full rounded-xl sm:w-64" />
          <Skeleton className="h-11 min-w-0 flex-1 basis-[220px] rounded-xl" />
        </div>
        <div className="flex flex-col">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-black/5 px-6 py-[15px] last:border-b-0"
            >
              <Skeleton className="h-4 w-40 max-w-[40%]" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-6 w-24 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
