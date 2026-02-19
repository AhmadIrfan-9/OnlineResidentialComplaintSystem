import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdminRole } from "@/lib/roles";

export const requireAdminUser = async () => {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    return null;
  }
  return session.user;
};

export const logAudit = async (params: {
  userId?: string | null;
  userName: string;
  action: string;
  resource: string;
  before?: string | null;
  after?: string | null;
  ipAddress?: string | null;
}) => {
  await db.auditLog.create({
    data: {
      userId: params.userId ?? null,
      userName: params.userName,
      action: params.action,
      resource: params.resource,
      before: params.before ?? null,
      after: params.after ?? null,
      ipAddress: params.ipAddress ?? null,
    },
  });
};

