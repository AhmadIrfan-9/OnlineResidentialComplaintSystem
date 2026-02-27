import http from "http";
import { Server } from "socket.io";
import { db } from "../lib/db";
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

      socket.join(roomNameForStudent(context.studentId));
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

      const recipientId =
        senderRole === "STUDENT"
          ? context.managementRecipientId
          : context.studentId;

      const created = await db.supportMessage.create({
        data: {
          complaintId: context.complaintId,
          studentId: context.studentId,
          senderId: identity.userId,
          senderRole,
          recipientId,
          content,
          contentType,
        },
      });

      const serialized = serializeMessage(created);
      io.to(roomNameForStudent(context.studentId)).emit("message:new", serialized);
      io.to(roomNameForComplaint(context.complaintId)).emit("message:new", serialized);
      io.to(managementRoomName()).emit("chat:active:refresh", {
        studentId: context.studentId,
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

      const result = await db.supportMessage.updateMany({
        where: {
          complaintId: context.complaintId,
          recipientId: identity.userId,
          readStatus: false,
        },
        data: { readStatus: true },
      });

      io.to(roomNameForStudent(context.studentId)).emit("message:read", {
        complaintId: context.complaintId,
        studentId: context.studentId,
        readerId: identity.userId,
        updated: result.count,
      });
      ack?.({ ok: true, updated: result.count });
    } catch (error) {
      console.error("[Socket mark_read error]", error);
      ack?.({ ok: false, message: "Failed to mark as read" });
    }
  });
});

server.listen(port, () => {
  console.log(`[Socket] Listening on :${port}`);
});
