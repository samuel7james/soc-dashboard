import type { MitreTechnique } from "@soc/types";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";

export function useMitreTechniques(tactic?: string) {
  return useQuery({
    queryKey: ["mitre-techniques", tactic ?? "all"],
    queryFn: () =>
      apiFetch<{ items: MitreTechnique[] }>(
        `/api/v1/mitre/techniques${tactic ? `?tactic=${encodeURIComponent(tactic)}` : ""}`,
      ),
    staleTime: 60 * 60_000,
  });
}
