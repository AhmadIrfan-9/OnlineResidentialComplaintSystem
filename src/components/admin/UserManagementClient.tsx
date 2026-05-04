"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";

type Role = "STUDENT" | "MANAGEMENT" | "IT_STAFF_ADMIN";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  hostelId: string;
  status: "Active" | "Inactive";
  lastLogin: string;
};

type HostelOption = {
  id: string;
  name: string;
};

type RoomOption = {
  id: string;
  roomNumber: string;
  floor: number;
  hostel: {
    id: string;
    name: string;
  };
};

const prettyRole = (role: Role): string => {
  if (role === "IT_STAFF_ADMIN") return "Admin";
  if (role === "MANAGEMENT") return "Management";
  return "Student";
};

const formatLastLogin = (value: string | null): string => {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
};

const mapApiUser = (u: {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  wardenHostels?: Array<{ id: string; name: string }>;
  studentProfile?: { room?: { hostel?: { id: string; name: string } } } | null;
}): UserRow => {
  const managedHostel = u.wardenHostels?.[0];
  const studentHostel = u.studentProfile?.room?.hostel;
  const chosen = managedHostel ?? studentHostel;

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    hostelId: chosen?.id ?? "",
    status: u.isActive ? "Active" : "Inactive",
    lastLogin: formatLastLogin(u.lastLoginAt),
  };
};

export function UserManagementClient({
  hostels,
  rooms,
}: {
  hostels: HostelOption[];
  rooms: RoomOption[];
}) {
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    role: "STUDENT" as Role,
    roomId: "",
    hostelId: "",
    isActive: true,
  });

  const selectedUser = users.find((u) => u.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    return users
      .filter((u) => (roleFilter === "All" ? true : prettyRole(u.role) === roleFilter))
      .filter((u) => (statusFilter === "All" ? true : u.status === statusFilter))
      .filter((u) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
      });
  }, [roleFilter, statusFilter, searchQuery, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedUsers = useMemo(() => {
    return filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filtered, currentPage, ITEMS_PER_PAGE]);

  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, statusFilter, searchQuery]);

  const availableCreateRooms = useMemo(() => {
    if (!newUser.hostelId) return rooms;
    return rooms.filter((room) => room.hostel.id === newUser.hostelId);
  }, [newUser.hostelId, rooms]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setNotice(data.message ?? "Failed to load users");
        return;
      }

      const nextUsers = (data.users ?? []).map(mapApiUser);
      setUsers(nextUsers);
      if (!selectedId && nextUsers.length > 0) {
        setSelectedId(nextUsers[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const updateSelected = (patch: Partial<UserRow>) => {
    if (!selectedUser) return;
    setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, ...patch } : u)));
  };

  const createUser = async () => {
    if (!newUser.name || !newUser.email) {
      setNotice("Name and email are required.");
      return;
    }
    if (newUser.role === "MANAGEMENT" && !newUser.hostelId) {
      setNotice("Hostel is required for management.");
      return;
    }
    if (newUser.role === "STUDENT" && !newUser.roomId) {
      setNotice("Room is required for student.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice(data.message ?? "Failed to create user");
        return;
      }

      setNotice("User created. Default password is ChangeMe123!");
      setShowCreate(false);
      setNewUser({
        name: "",
        email: "",
        phone: "",
        role: "STUDENT",
        roomId: "",
        hostelId: "",
        isActive: true,
      });
      await loadUsers();
    } finally {
      setSaving(false);
    }
  };

  const saveSelected = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedUser.name,
          email: selectedUser.email,
          role: selectedUser.role,
          isActive: selectedUser.status === "Active",
          hostelId: selectedUser.role === "MANAGEMENT" ? selectedUser.hostelId || null : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice(data.message ?? "Failed to save user");
        return;
      }

      setNotice("User updated.");
      await loadUsers();
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice(data.message ?? "Failed to reset password");
        return;
      }

      setNotice("Password reset to ChangeMe123!");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelected = async (idToDelete?: string) => {
    const defaultId = idToDelete ?? selectedUser?.id;
    if (!defaultId) return;

    const uName = users.find(u => u.id === defaultId)?.name ?? "user";
    const confirmed = window.confirm(`Delete user ${uName}?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${defaultId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice(data.message ?? "Failed to delete user");
        return;
      }

      setNotice("User deleted.");
      await loadUsers();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {notice ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">{notice}</p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="surface-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Users</h2>
            <button className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-3 py-2 text-sm text-white shadow-md shadow-sky-200" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Close" : "Add User"}
            </button>
          </div>

          {showCreate ? (
            <div className="mb-3 grid gap-2 rounded-lg border border-slate-200 bg-gradient-to-br from-sky-50 to-white p-3 md:grid-cols-2">
              <input
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Name"
                value={newUser.name}
                onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
              />
              <input
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Phone (optional)"
                value={newUser.phone}
                onChange={(e) => setNewUser((p) => ({ ...p, phone: e.target.value }))}
              />
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={newUser.role}
                onChange={(e) =>
                  setNewUser((p) => ({
                    ...p,
                    role: e.target.value as Role,
                    roomId: "",
                    hostelId: "",
                  }))
                }
              >
                <option value="STUDENT">Student</option>
                <option value="MANAGEMENT">Management</option>
                <option value="IT_STAFF_ADMIN">Admin</option>
              </select>
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={newUser.hostelId}
                onChange={(e) =>
                  setNewUser((p) => ({
                    ...p,
                    hostelId: e.target.value,
                    roomId: p.role === "STUDENT" ? "" : p.roomId,
                  }))
                }
                disabled={newUser.role === "IT_STAFF_ADMIN"}
              >
                <option value="">
                  {newUser.role === "IT_STAFF_ADMIN" ? "Not required for admin" : "Select hostel"}
                </option>
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              {newUser.role === "STUDENT" ? (
                <select
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
                  value={newUser.roomId}
                  onChange={(e) => setNewUser((p) => ({ ...p, roomId: e.target.value }))}
                >
                  <option value="">Select room</option>
                  {availableCreateRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.hostel.name} - {room.roomNumber}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="md:col-span-2">
                <button
                  className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={createUser}
                  disabled={saving}
                >
                  Create User
                </button>
              </div>
            </div>
          ) : null}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search users by name, email, or ID..."
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option>All</option>
              <option>Student</option>
              <option>Management</option>
              <option>Admin</option>
            </select>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>All</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>

          {loading ? <p className="text-sm text-slate-600">Loading users...</p> : null}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-[#f8f9fa] text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold text-slate-900">User ID</th>
                  <th className="py-3 px-4 font-semibold text-slate-900">User Profile</th>
                  <th className="py-3 px-4 font-semibold text-slate-900">Role</th>
                  <th className="py-3 px-4 font-semibold text-slate-900">Hostel</th>
                  <th className="py-3 px-4 font-semibold text-slate-900">Status</th>
                  <th className="py-3 px-4 font-semibold text-slate-900 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedUsers.map((u) => {
                  const hostelName = hostels.find((h) => h.id === u.hostelId)?.name ?? "-";
                  return (
                    <tr
                      key={u.id}
                      className={`group relative border-t border-slate-100 transition-colors ${
                        u.id === selectedId ? "bg-sky-50" : "hover:bg-[#f8f9fa]"
                      }`}
                      onClick={(e) => {
                         // Prevent row click if clicking action buttons
                         if ((e.target as HTMLElement).closest('button')) return;
                         setSelectedId(u.id);
                      }}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900">{u.id.split("-")[0]}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{u.name}</span>
                          <span className="text-xs text-slate-500">{u.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{prettyRole(u.role)}</td>
                      <td className="py-3 px-4 text-slate-600">{hostelName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                            u.status === "Active"
                              ? "bg-[#e2f5ec] text-[#2ebd6c]"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="relative inline-flex items-center justify-end gap-2 w-full">
                          <button 
                             className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all"
                             onClick={(e) => { e.stopPropagation(); setSelectedId(u.id); }}
                             title="Edit User"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button 
                             className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
                             onClick={(e) => { e.stopPropagation(); deleteSelected(u.id); }}
                             title="Delete User"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          {/* Hover Tooltip below Actions column */}
                          <div className="absolute top-full right-0 mt-1 z-10 hidden group-hover:block w-48 rounded bg-slate-800 p-2 text-xs font-medium text-white shadow-xl">
                            <span className="mb-1 block text-slate-400">Last Login Details</span>
                            {u.lastLogin}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedUsers.length === 0 && !loading && (
                   <tr>
                     <td colSpan={6} className="py-8 text-center text-slate-500">No users found based on filters.</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <p>Page {currentPage} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border border-slate-200 bg-white p-1.5 hover:bg-slate-50 disabled:opacity-50 text-slate-700"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                className="rounded-md border border-slate-200 bg-white p-1.5 hover:bg-slate-50 disabled:opacity-50 text-slate-700"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="h-fit surface-card p-4 sticky top-6">
          <h2 className="mb-3 text-base font-semibold text-slate-900">User detail / edit</h2>
          {!selectedUser ? (
            <p className="text-sm text-slate-600">Select a user from the table.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">User ID</span>
                <input className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2" value={selectedUser.id} readOnly />
              </label>

              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Name</span>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                  value={selectedUser.name}
                  onChange={(e) => updateSelected({ name: e.target.value })}
                />
              </label>

              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Email</span>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                  value={selectedUser.email}
                  onChange={(e) => updateSelected({ email: e.target.value })}
                />
              </label>

              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Role</span>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                  value={selectedUser.role}
                  onChange={(e) => updateSelected({ role: e.target.value as Role, hostelId: "" })}
                >
                  <option value="STUDENT">Student</option>
                  <option value="MANAGEMENT">Management</option>
                  <option value="IT_STAFF_ADMIN">Admin</option>
                </select>
              </label>

              {selectedUser.role === "MANAGEMENT" ? (
                <label className="block space-y-1">
                  <span className="font-medium text-slate-700">Hostel</span>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                    value={selectedUser.hostelId}
                    onChange={(e) => updateSelected({ hostelId: e.target.value })}
                  >
                    <option value="">Select hostel</option>
                    {hostels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Status</span>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                  value={selectedUser.status}
                  onChange={(e) => updateSelected({ status: e.target.value as "Active" | "Inactive" })}
                >
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Last login</span>
                <input className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2" value={selectedUser.lastLogin} readOnly />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={saveSelected}
                  disabled={saving}
                >
                  Save
                </button>
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={resetPassword}
                  disabled={saving}
                >
                  Reset Password
                </button>
                <button
                  className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => deleteSelected()}
                  disabled={saving}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
