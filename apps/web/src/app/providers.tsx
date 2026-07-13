"use client";

import { ThemeProvider } from "@soc/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState } from "react";

import { fetchCsrfToken } from "@/lib/api/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    // Primes the CSRF cookie before the user submits anything mutating (e.g.
    // the login form) — without this, the very first POST of a fresh visit
    // would have no cookie to echo back and would 403.
    void fetchCsrfToken();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
        {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
