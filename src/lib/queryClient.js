import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // 1 menit
      gcTime: 5 * 60_000,      // 5 menit
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
