"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import type { MessagePayload } from "@/lib/messaging";

type ActiveChatSummary = {
  studentId: string;
  complaintId: string;
  complaintTitle: string;
  studentName: string;
  studentEmail: string;
  unreadCount: number;
  latestMessage: {
    messageId: string;
    content: string;
    timestamp: string;
    senderRole: "STUDENT" | "MANAGEMENT";
  } | null;
};

export function ManagementSupportDashboard() {
  const { data } = useSession();
  const socketBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4001",
    []
  );

  const managementId = data?.user?.id ?? "";
  const managementRole = data?.user?.role ?? "";

  const [status, setStatus] = useState("Connecting...");
  const [activeChats, setActiveChats] = useState<ActiveChatSummary[]>([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>("");
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [messageInput, setMessageInput] = useState("");

  const loadActiveChats = useCallback(async () => {
    const response = await fetch("/api/messages/active");
    if (!response.ok) return;
    const payload = (await response.json()) as { chats?: ActiveChatSummary[] };
    const chats = payload.chats ?? [];
    setActiveChats(chats);
    if (!selectedComplaintId && chats.length > 0) {
      setSelectedComplaintId(chats[0].complaintId);
    }
  }, [selectedComplaintId]);

  const loadHistory = useCallback(async (complaintId: string) => {
    if (!complaintId) return;
    const response = await fetch(`/api/messages?complaintId=${complaintId}`);
    if (!response.ok) return;
    const payload = (await response.json()) as { messages?: MessagePayload[] };
    setMessages(payload.messages ?? []);
    await fetch("/api/messages/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaintId }),
    });
    await loadActiveChats();
  }, [loadActiveChats]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadActiveChats();
  }, [loadActiveChats]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory(selectedComplaintId);
  }, [selectedComplaintId, loadHistory]);

  useEffect(() => {
    if (!managementId || !managementRole) return;

    const socket: Socket = io(socketBaseUrl, {
      transports: ["websocket", "polling"],
      auth: {
        userId: managementId,
        role: managementRole,
      },
    });

    socket.on("connect", () => {
      setStatus("Connected");
      if (selectedComplaintId) {
        socket.emit("join_complaint_room", selectedComplaintId);
        socket.emit("mark_read", selectedComplaintId);
      }
    });
    socket.on("disconnect", () => setStatus("Disconnected"));

    socket.on("message:new", (message: MessagePayload) => {
      if (message.complaintId === selectedComplaintId) {
        setMessages((prev) => [...prev, message]);
        socket.emit("mark_read", message.complaintId);
      }
      loadActiveChats();
    });

    socket.on("chat:active:refresh", () => {
      loadActiveChats();
    });

    if (selectedComplaintId) {
      socket.emit("join_complaint_room", selectedComplaintId);
      socket.emit("mark_read", selectedComplaintId);
    }

    return () => {
      socket.disconnect();
    };
  }, [managementId, managementRole, selectedComplaintId, socketBaseUrl, loadActiveChats]);

  const onSendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = messageInput.trim();
    if (!trimmed || !selectedComplaintId) return;

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        complaintId: selectedComplaintId,
        content: trimmed,
        contentType: "TEXT",
      }),
    });

    if (!response.ok) return;

    const payload = (await response.json()) as { message?: MessagePayload };
    if (payload.message) {
      setMessages((prev) => [...prev, payload.message as MessagePayload]);
      setMessageInput("");
      loadActiveChats();
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <section className="surface-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Active Student Chats</h2>
          <span className="text-[11px] text-slate-600">{status}</span>
        </div>
        <div className="space-y-2">
          {activeChats.map((chat) => (
            <button
              key={chat.complaintId}
              className={`w-full rounded border p-2 text-left ${
                selectedComplaintId === chat.complaintId
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 bg-white"
              }`}
              onClick={() => setSelectedComplaintId(chat.complaintId)}
            >
              <p className="text-sm font-medium text-slate-900">{chat.studentName}</p>
              <p className="truncate text-xs text-slate-500">{chat.complaintTitle}</p>
              <p className="truncate text-xs text-slate-600">
                {chat.latestMessage?.content ?? "No messages yet"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {chat.latestMessage
                  ? new Date(chat.latestMessage.timestamp).toLocaleString()
                  : ""}
              </p>
            </button>
          ))}
          {activeChats.length === 0 && (
            <p className="text-sm text-slate-500">No active chats yet.</p>
          )}
        </div>
      </section>

      <section className="surface-card p-4">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Student Support Thread</h2>
        <div className="h-96 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3">
          {selectedComplaintId === "" ? (
            <p className="text-sm text-slate-500">Select a student chat to begin.</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-slate-500">No messages in this thread.</p>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <div
                  key={message.messageId}
                  className={`max-w-[85%] rounded px-3 py-2 text-sm ${
                    message.senderId === managementId
                      ? "ml-auto bg-blue-600 text-white"
                      : "bg-white text-slate-800"
                  }`}
                >
                  <p>{message.content}</p>
                  <p className="mt-1 text-[11px] opacity-70">
                    {new Date(message.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <form className="mt-3 flex gap-2" onSubmit={onSendMessage}>
          <input
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Reply to student..."
            value={messageInput}
            onChange={(event) => setMessageInput(event.target.value)}
            disabled={!selectedComplaintId}
          />
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={!selectedComplaintId}
          >
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
