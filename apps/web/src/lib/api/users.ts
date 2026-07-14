import type { User } from "@soc/types";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<{ items: User[] }>("/api/v1/users"),
    staleTime: 60_000,
  });
}
