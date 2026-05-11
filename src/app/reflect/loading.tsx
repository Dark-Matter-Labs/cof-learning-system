import { Skeleton } from '@/components/ui/Skeleton';

export default function ReflectLoading() {
  return (
    <div className="page-with-nav max-w-3xl mx-auto px-6 py-8">
      <Skeleton className="h-6 w-36 mb-2" />
      <Skeleton className="h-4 w-72 mb-8" />
      <Skeleton className="h-40 w-full mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
