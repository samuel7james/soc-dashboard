"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useCurrentUser } from "@/lib/api/use-auth";
import { useRealtimeUpdates } from "@/lib/ws/use-realtime";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isPending, isError } = useCurrentUser();

  const unauthenticated = !isPending && (isError || !data);

  useEffect(() => {
    if (unauthenticated) {
      router.replace("/login");
    }
  }, [unauthenticated, router]);

  // Only connect once we know the user is authenticated — otherwise every
  // page load briefly opens (and gets rejected from) a socket before redirecting.
  useRealtimeUpdates(!isPending && !unauthenticated);

  if (isPending) {
    return (
      <div className="text-muted-foreground flex h-screen items-center justify-center text-sm">Loading…</div>
    );
  }

  if (unauthenticated) {
    return null;
  }

  return <>{children}</>;
}
