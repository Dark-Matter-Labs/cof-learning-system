import { Skeleton } from '@/components/ui/Skeleton';

export default function QueryLoading() {
  return (
    <div className="page-with-nav max-w-4xl mx-auto px-6 py-8">
      <Skeleton className="h-6 w-36 mb-2" />
      <Skeleton className="h-4 w-64 mb-8" />
      <div className="flex gap-4 h-[calc(100vh-200px)]">
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-20 w-2/3 ml-auto" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
