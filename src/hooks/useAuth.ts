"use client";

import { useSession } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    session,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    user: session?.user,
    userRole: session?.user?.role,
    userId: session?.user?.id,
    hostelId: session?.user?.hostelId,
  };
}
