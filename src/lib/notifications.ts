import { db } from "./db";
import { redisServiceProvider } from "./redis";
import { REDIS_CHANNEL_WS_NOTIFICATION_NEW } from "./redis/channels";

export type InAppNotification = {
  id: string;
  userId: string;
  complaintId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export const createInAppNotification = async (input: {
  userId: string;
  complaintId: string;
  message: string;
}): Promise<InAppNotification> => {
  const created = await db.notification.create({
    data: {
      userId: input.userId,
      complaintId: input.complaintId,
      message: input.message,
    },
    select: {
      id: true,
      userId: true,
      complaintId: true,
      message: true,
      isRead: true,
      createdAt: true,
    },
  });

  const payload: InAppNotification = {
    ...created,
    createdAt: created.createdAt.toISOString(),
  };

  try {
    await redisServiceProvider.publish(
      REDIS_CHANNEL_WS_NOTIFICATION_NEW,
      JSON.stringify(payload)
    );
  } catch (error) {
    console.error("[Notification Publish Error]", error);
  }

  return payload;
};
