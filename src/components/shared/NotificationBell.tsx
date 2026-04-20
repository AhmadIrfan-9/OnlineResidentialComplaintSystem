"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { io, type Socket } from "socket.io-client";

type NotificationItem = {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  complaintId: string;
};

const shouldHideBell = (pathname: string): boolean => pathname === "/login";

export function NotificationBell() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const socketBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4001",
    []
  );

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);
  const hidden = shouldHideBell(pathname);

  useEffect(() => {
    if (status !== "authenticated") return;

    let active = true;
    const fetchNotifications = async () => {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { notifications?: NotificationItem[] };
      if (!active) return;
      setItems(payload.notifications ?? []);
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;

    const socket: Socket = io(socketBaseUrl, {
      transports: ["websocket", "polling"],
      auth: {
        userId: session.user.id,
        role: session.user.role,
      },
    });

    socket.on("notification:new", (notification: NotificationItem) => {
      setItems((prev) => {
        if (prev.some((item) => item.id === notification.id)) return prev;
        return [notification, ...prev];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [status, session?.user?.id, session?.user?.role, socketBaseUrl]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (hidden || status !== "authenticated" || !session?.user?.id) {
    return null;
  }

  const toComplaintPath = (complaintId: string): string => {
    const role = String(session.user.role ?? "").toUpperCase();
    if (role === "STUDENT") return `/complaints/${complaintId}`;
    if (role === "MANAGEMENT" || role === "IT_STAFF_ADMIN") return `/warden/complaints/${complaintId}`;
    return `/complaints/${complaintId}`;
  };

  const onClickItem = async (item: NotificationItem) => {
    if (!item.isRead) {
      setItems((prev) =>
        prev.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry))
      );
      await fetch(`/api/notifications/${item.id}/read`, { method: "PATCH" });
    }
    setOpen(false);
    router.push(toComplaintPath(item.complaintId));
    router.refresh();
  };

  return (
    <div ref={panelRef} className="fixed right-4 top-4 z-50">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-full border border-slate-200 bg-white p-2 shadow-sm hover:bg-slate-50"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-slate-700" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="mt-2 w-[340px] max-w-[90vw] rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500">No notifications yet.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onClickItem(item)}
                  className="w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <p
                    className={`text-sm text-slate-800 ${
                      item.isRead ? "font-normal" : "font-semibold"
                    }`}
                  >
                    {item.message}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
