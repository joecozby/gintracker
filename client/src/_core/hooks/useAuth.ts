/**
 * Auth has been removed from this app — all routes are public.
 * This stub keeps the import in DashboardLayout working while returning
 * sensible no-op values.
 */
export function useAuth() {
  return {
    user: null,
    loading: false,
    isAuthenticated: false,
    error: null,
    logout: async () => {},
    refresh: () => {},
  };
}
