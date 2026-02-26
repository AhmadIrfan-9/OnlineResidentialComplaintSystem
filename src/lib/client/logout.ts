"use client";

import { signOut } from "next-auth/react";

type LogoutReason = "manual" | "inactive";

export async function logoutAndRedirect(reason: LogoutReason = "manual") {
  await signOut({ redirect: false });
  window.location.replace(`/login?logout=${reason}`);
}
