"use client";

import { SessionProvider } from "next-auth/react";
import { PropsWithChildren } from "react";
import { SessionInactivityGuard } from "@/components/shared/SessionInactivityGuard";

export function AuthProvider({ children }: PropsWithChildren) {
  return (
    <SessionProvider>
      <SessionInactivityGuard />
      {children}
    </SessionProvider>
  );
}
