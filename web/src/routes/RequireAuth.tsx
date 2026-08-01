import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/auth/useAuth";

/**
 * Where the visitor was headed travels in the navigation state, so signing in returns them there
 * instead of dropping them on the listing.
 */
export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
