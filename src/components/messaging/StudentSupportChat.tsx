"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import type { MessagePayload } from "@/lib/messaging";

type Props = {
  complaintId: string;
};

export function StudentSupportChat({ complaintId }: Props) {
  const { data } = useSession();
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const socketBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4001",
    []
  );

  const studentId = data?.user?.id ?? "";
  const role = data?.user?.role ?? "";

  useEffect(() => {
    if (!studentId) return;

    const fetchHistory = async () => {
      const res = await fetch(`/api/messages?complaintId=${complaintId}`);
      if (!res.ok) return;
      const payload = (await res.json()) as { messages?: MessagePayload[] };
      setMessages(payload.messages ?? []);
    };
    fetchHistory();
  }, [studentId, complaintId]);

  useEffect(() => {
    if (!studentId || !role) return;

    const socket: Socket = io(socketBaseUrl, {
      transports: ["websocket", "polling"],
      auth: {
        userId: studentId,
        role,
      },
    });

    socket.on("connect", () => {
      setStatus("Connected");
      socket.emit("join_complaint_room", complaintId);
      socket.emit("mark_read", complaintId);
    });

    socket.on("disconnect", () => {
      setStatus("Disconnected");
    });

    socket.on("message:new", (message: MessagePayload) => {
      if (message.complaintId !== complaintId) return;
      setMessages((prev) => [...prev, message]);
      if (message.recipientId === studentId) {
        socket.emit("mark_read", complaintId);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [studentId, role, socketBaseUrl, complaintId]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = messageInput.trim();
    if (!trimmed || !studentId) return;

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        complaintId,
        content: trimmed,
        contentType: "TEXT",
      }),
    });

    if (!response.ok) return;

    const payload = (await response.json()) as { message?: MessagePayload };
    if (payload.message) {
      setMessages((prev) => [...prev, payload.message as MessagePayload]);
      setMessageInput("");
    }
  };

  return (
    <section className="surface-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Support Chat</h2>
        <span className="text-xs text-slate-600">{status}</span>
      </header>

      <div className="h-96 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <div
                key={message.messageId}
                className={`max-w-[85%] rounded px-3 py-2 text-sm ${
                  message.senderId === studentId
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

      <form className="mt-3 flex gap-2" onSubmit={sendMessage}>
        <input
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Type your message..."
          value={messageInput}
          onChange={(event) => setMessageInput(event.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Send
        </button>
      </form>
    </section>
  );
}
