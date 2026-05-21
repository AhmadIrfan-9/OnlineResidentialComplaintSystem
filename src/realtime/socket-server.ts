import http from "http";
import { Server } from "socket.io";
import { db } from "../lib/db";
import { redisServiceProvider } from "../lib/redis";
import { createInAppNotification } from "../lib/notifications";
import {
  REDIS_CHANNEL_WS_CHAT_ACTIVE_REFRESH,
  REDIS_CHANNEL_WS_MESSAGE_NEW,
  REDIS_CHANNEL_WS_MESSAGE_READ,
  REDIS_CHANNEL_WS_NOTIFICATION_NEW,
  REDIS_CHANNEL_WS_PRESENCE_CHANGED,
} from "../lib/redis/channels";
import {
  canAccessComplaint,
  managementRoomName,
  roomNameForComplaint,
  roomNameForStudent,
  resolveComplaintMessagingContext,
  serializeMessage,
  toChatRole,
} from "../lib/messaging";

type AuthPayload = {
  userId: string;
  role: string;
};

type SendMessagePayload = {
  complaintId: string;
  content: string;
  contentType?: string;
};

const port = Number.parseInt(process.env.SOCKET_PORT ?? "4001", 10);
const corsOrigin = process.env.SOCKET_CORS_ORIGIN ?? "*";

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "orcs-socket" }));
});

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

const hasActiveSocketForUser = (userId: string): boolean => {
  for (const connectedSocket of io.sockets.sockets.values()) {
    const identity = connectedSocket.data.user as AuthPayload | undefined;
    if (identity?.userId === userId && connectedSocket.connected) {
      return true;
    }
  }
  return false;
};

const publishWsEvent = async (channel: string, payload: unknown): Promise<void> => {
  await redisServiceProvider.publish(channel, JSON.stringify(payload));
};

io.use((socket, next) => {
  const auth = socket.handshake.auth as Partial<AuthPayload>;
  if (!auth?.userId || !auth?.role) {
    next(new Error("Unauthorized socket connection"));
    return;
  }
  socket.data.user = {
    userId: String(auth.userId),
    role: String(auth.role),
  } satisfies AuthPayload;
  next();
});

io.on("connection", (socket) => {
  const identity = socket.data.user as AuthPayload;
  const senderRole = toChatRole(identity.role);
  socket.join(`user:${identity.userId}`);

  void redisServiceProvider
    .addActiveUser(identity.userId)
    .then(() =>
      publishWsEvent(REDIS_CHANNEL_WS_PRESENCE_CHANGED, {
        userId: identity.userId,
        isActive: true,
      })
    )
    .catch((error) => {
      console.error("[Socket presence add error]", error);
    });

  if (senderRole === "STUDENT") {
    socket.join(roomNameForStudent(identity.userId));
  } else {
    socket.join(managementRoomName());
  }

  socket.on("join_complaint_room", async (complaintId: string, ack?: (v: unknown) => void) => {
    try {
      const normalizedComplaintId = String(complaintId ?? "").trim();
      if (!normalizedComplaintId) {
        ack?.({ ok: false, message: "complaintId is required" });
        return;
      }

      const context = await resolveComplaintMessagingContext(normalizedComplaintId);
      if (!context) {
        ack?.({ ok: false, message: "Complaint not found" });
        return;
      }

      if (!canAccessComplaint(identity.role, identity.userId, context.complaint)) {
        ack?.({ ok: false, message: "Forbidden room access" });
        return;
      }

      if (context.studentId) {
        socket.join(roomNameForStudent(context.studentId));
      }
      socket.join(roomNameForComplaint(context.complaintId));
      const recentMessages = await db.supportMessage.findMany({
        where: { complaintId: context.complaintId },
        orderBy: { timestamp: "desc" },
        take: 50,
      });

      ack?.({
        ok: true,
        complaintId: context.complaintId,
        studentId: context.studentId,
        messages: recentMessages.reverse().map(serializeMessage),
      });
    } catch (error) {
      console.error("[Socket join_complaint_room error]", error);
      ack?.({ ok: false, message: "Failed to join room" });
    }
  });

  socket.on("send_message", async (payload: SendMessagePayload, ack?: (v: unknown) => void) => {
    try {
      const complaintId = String(payload?.complaintId ?? "").trim();
      const content = String(payload?.content ?? "").trim();
      const contentType = String(payload?.contentType ?? "TEXT").trim().toUpperCase();

      if (!complaintId || !content) {
        ack?.({ ok: false, message: "complaintId and content are required" });
        return;
      }

      const context = await resolveComplaintMessagingContext(complaintId);
      if (!context) {
        ack?.({ ok: false, message: "Complaint not found" });
        return;
      }

      if (!canAccessComplaint(identity.role, identity.userId, context.complaint)) {
        ack?.({ ok: false, message: "Forbidden to message in this room" });
        return;
      }

      const studentId = context.studentId;
      if (!studentId) {
        ack?.({ ok: false, message: "Messaging is not available for anonymous complaints" });
        return;
      }

      const recipientId =
        senderRole === "STUDENT"
          ? context.managementRecipientId
          : studentId;

      const created = await db.supportMessage.create({
        data: {
          complaintId: context.complaintId,
          studentId: studentId,
          senderId: identity.userId,
          senderRole,
          recipientId,
          content,
          contentType,
        },
      });

      if (senderRole === "MANAGEMENT") {
        await createInAppNotification({
          userId: studentId,
          complaintId: context.complaintId,
          message: "Management sent you a new support message.",
        });
      } else {
        await createInAppNotification({
          userId: context.managementRecipientId,
          complaintId: context.complaintId,
          message: "A student sent you a new support message.",
        });
      }

      const serialized = serializeMessage(created);
      await publishWsEvent(REDIS_CHANNEL_WS_MESSAGE_NEW, serialized);
      await publishWsEvent(REDIS_CHANNEL_WS_CHAT_ACTIVE_REFRESH, {
        studentId: studentId,
        complaintId: context.complaintId,
      });
      ack?.({ ok: true, message: serialized });
    } catch (error) {
      console.error("[Socket send_message error]", error);
      ack?.({ ok: false, message: "Failed to send message" });
    }
  });

  socket.on("mark_read", async (complaintId: string, ack?: (v: unknown) => void) => {
    try {
      const normalizedComplaintId = String(complaintId ?? "").trim();
      if (!normalizedComplaintId) {
        ack?.({ ok: false, message: "complaintId is required" });
        return;
      }

      const context = await resolveComplaintMessagingContext(normalizedComplaintId);
      if (!context) {
        ack?.({ ok: false, message: "Complaint not found" });
        return;
      }

      if (!canAccessComplaint(identity.role, identity.userId, context.complaint)) {
        ack?.({ ok: false, message: "Forbidden room access" });
        return;
      }

      const studentId = context.studentId;
      if (!studentId) {
        ack?.({ ok: false, message: "Messaging not available for anonymous complaints" });
        return;
      }

      const result = await db.supportMessage.updateMany({
        where: {
          complaintId: context.complaintId,
          recipientId: identity.userId,
          readStatus: false,
        },
        data: { readStatus: true },
      });

      await publishWsEvent(REDIS_CHANNEL_WS_MESSAGE_READ, {
        complaintId: context.complaintId,
        studentId: studentId,
        readerId: identity.userId,
        updated: result.count,
      });
      ack?.({ ok: true, updated: result.count });
    } catch (error) {
      console.error("[Socket mark_read error]", error);
      ack?.({ ok: false, message: "Failed to mark as read" });
    }
  });

  socket.on("disconnect", () => {
    void (async () => {
      if (hasActiveSocketForUser(identity.userId)) return;
      try {
        await redisServiceProvider.removeActiveUser(identity.userId);
        await publishWsEvent(REDIS_CHANNEL_WS_PRESENCE_CHANGED, {
          userId: identity.userId,
          isActive: false,
        });
      } catch (error) {
        console.error("[Socket presence remove error]", error);
      }
    })();
  });
});

const bootstrap = async () => {
  await redisServiceProvider.connect();

  await redisServiceProvider.subscribe(REDIS_CHANNEL_WS_MESSAGE_NEW, (message) => {
    try {
      const payload = JSON.parse(message) as { studentId: string; complaintId: string };
      io.to(roomNameForStudent(payload.studentId)).emit("message:new", payload);
      io.to(roomNameForComplaint(payload.complaintId)).emit("message:new", payload);
    } catch (error) {
      console.error("[Socket redis message:new parse error]", error);
    }
  });

  await redisServiceProvider.subscribe(REDIS_CHANNEL_WS_MESSAGE_READ, (message) => {
    try {
      const payload = JSON.parse(message) as { studentId: string };
      io.to(roomNameForStudent(payload.studentId)).emit("message:read", payload);
    } catch (error) {
      console.error("[Socket redis message:read parse error]", error);
    }
  });

  await redisServiceProvider.subscribe(REDIS_CHANNEL_WS_CHAT_ACTIVE_REFRESH, (message) => {
    try {
      const payload = JSON.parse(message) as Record<string, unknown>;
      io.to(managementRoomName()).emit("chat:active:refresh", payload);
    } catch (error) {
      console.error("[Socket redis chat:active:refresh parse error]", error);
    }
  });

  await redisServiceProvider.subscribe(REDIS_CHANNEL_WS_PRESENCE_CHANGED, (message) => {
    try {
      const payload = JSON.parse(message) as Record<string, unknown>;
      io.emit("presence:changed", payload);
    } catch (error) {
      console.error("[Socket redis presence:changed parse error]", error);
    }
  });

  await redisServiceProvider.subscribe(REDIS_CHANNEL_WS_NOTIFICATION_NEW, (message) => {
    try {
      const payload = JSON.parse(message) as { userId: string };
      io.to(`user:${payload.userId}`).emit("notification:new", payload);
    } catch (error) {
      console.error("[Socket redis notification:new parse error]", error);
    }
  });

  server.listen(port, () => {
    console.log(`[Socket] Listening on :${port}`);
  });
};

bootstrap().catch((error) => {
  console.error("[Socket bootstrap error]", error);
  process.exit(1);
});
