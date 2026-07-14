import { AlertTriangle, Inbox } from "lucide-react";

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
      <Inbox className="size-6" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-destructive flex flex-col items-center gap-2 py-12 text-sm">
      <AlertTriangle className="size-6" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function LoadingRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-muted h-8 animate-pulse rounded" />
      ))}
    </div>
  );
}
