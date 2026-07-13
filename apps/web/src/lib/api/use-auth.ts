import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type AuthUser, fetchMe, login, logout } from "./auth";

const ME_QUERY_KEY = ["auth", "me"];

export function useCurrentUser() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => login(email, password),
    onSuccess: (data) => {
      queryClient.setQueryData<{ user: AuthUser }>(ME_QUERY_KEY, data);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
      queryClient.clear();
    },
  });
}
