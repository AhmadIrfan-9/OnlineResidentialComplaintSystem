"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2, Search, ChevronLeft, ChevronRight, CheckCircle2, X } from "lucide-react";

type Role = "STUDENT" | "MANAGEMENT" | "IT_STAFF_ADMIN";
type UserRow = {
  id: string; name: string; email: string; role: Role;
  hostelId: string; roomLabel: string; status: "Active" | "Inactive"; lastLogin: string;
};
type HostelOption = { id: string; name: string };
type RoomOption = { id: string; roomNumber: string; floor: number; hostel: { id: string; name: string } };

const prettyRole = (role: Role) =>
  role === "IT_STAFF_ADMIN" ? "Admin" : role === "MANAGEMENT" ? "Management" : "Student";

const formatLastLogin = (v: string | null) => (!v ? "Never" : new Date(v).toLocaleString());

// ── Generate all valid Cendekiawan rooms ──────────────────────────────────────
const BLOCKS = ["C1", "C2", "C3"];
const FLOORS = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, "0"));
const UNITS  = Array.from({ length: 8  }, (_, i) => String(i + 1).padStart(2, "0"));

const ALL_ROOM_LABELS: string[] = BLOCKS.flatMap(b =>
  FLOORS.flatMap(f => UNITS.map(u => `${b}-${f}-${u}`))
); // 240 rooms total

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
      <p className="text-sm font-semibold text-slate-800">{message}</p>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600 transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Searchable Room Combobox ──────────────────────────────────────────────────
function RoomCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery]   = useState(value);
  const [open, setOpen]     = useState(false);
  const ref                 = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return q.length === 0 ? ALL_ROOM_LABELS.slice(0, 40) : ALL_ROOM_LABELS.filter(r => r.includes(q)).slice(0, 40);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (room: string) => { onChange(room); setQuery(room); setOpen(false); };

  return (
    <div ref={ref} className="relative md:col-span-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          placeholder='Search room (e.g. C2-04-01)…'
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); onChange(""); }}
          onFocus={() => setOpen(true)}
        />
        {value && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            {value}
          </span>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
          {filtered.map(room => (
            <button
              key={room}
              type="button"
              onClick={() => select(room)}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-sky-50 hover:text-sky-700 transition-colors font-mono ${room === value ? "bg-sky-50 font-bold text-sky-700" : "text-slate-700"}`}
            >
              {room}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const mapApiUser = (u: {
  id: string; name: string; email: string; role: Role; isActive: boolean;
  lastLoginAt: string | null;
  wardenHostels?: Array<{ id: string; name: string }>;
  studentProfile?: { assignedRoom?: string | null; room?: { hostel?: { id: string; name: string } } } | null;
}): UserRow => {
  const managedHostel = u.wardenHostels?.[0];
  const studentHostel = u.studentProfile?.room?.hostel;
  const chosen = managedHostel ?? studentHostel;
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    hostelId: chosen?.id ?? "",
    roomLabel: u.studentProfile?.assignedRoom ?? "",
    status: u.isActive ? "Active" : "Inactive",
    lastLogin: formatLastLogin(u.lastLoginAt),
  };
};

// ── Field + label helper ──────────────────────────────────────────────────────
const fieldCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1";

export function UserManagementClient({ hostels, rooms }: { hostels: HostelOption[]; rooms: RoomOption[] }) {
  const [roleFilter,    setRoleFilter]    = useState("All");
  const [statusFilter,  setStatusFilter]  = useState("All");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [currentPage,   setCurrentPage]   = useState(1);
  const ITEMS_PER_PAGE = 8;
  const [users,       setUsers]       = useState<UserRow[]>([]);
  const [selectedId,  setSelectedId]  = useState("");
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [notice,      setNotice]      = useState("");
  const [toast,       setToast]       = useState("");
  const [showCreate,  setShowCreate]  = useState(false);
  const [newUser, setNewUser] = useState({
    name: "", email: "", role: "STUDENT" as Role,
    roomLabel: "", hostelId: "", isActive: true,
  });

  const selectedUser = users.find(u => u.id === selectedId) ?? null;

  const filtered = useMemo(() =>
    users
      .filter(u => roleFilter   === "All" ? true : prettyRole(u.role) === roleFilter)
      .filter(u => statusFilter === "All" ? true : u.status === statusFilter)
      .filter(u => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
      }),
    [roleFilter, statusFilter, searchQuery, users]
  );

  const totalPages    = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedUsers = useMemo(() =>
    filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filtered, currentPage]
  );

  useEffect(() => { setCurrentPage(1); }, [roleFilter, statusFilter, searchQuery]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { setNotice(data.message ?? "Failed to load users"); return; }
      const next = (data.users ?? []).map(mapApiUser);
      setUsers(next);
      if (!selectedId && next.length > 0) setSelectedId(next[0].id);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  const updateSelected = (patch: Partial<UserRow>) => {
    if (!selectedUser) return;
    setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...patch } : u));
  };

  const createUser = async () => {
    if (!newUser.name || !newUser.email) { setNotice("Name and email are required."); return; }
    if (newUser.role === "MANAGEMENT" && !newUser.hostelId) { setNotice("Hostel is required for management."); return; }
    if (newUser.role === "STUDENT"    && !newUser.roomLabel)  { setNotice("Room is required for student."); return; }

    setSaving(true);
    try {
      const res  = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:       newUser.name,
          email:      newUser.email,
          role:       newUser.role,
          hostelId:   newUser.hostelId || undefined,
          roomLabel:  newUser.roomLabel || undefined,
          isActive:   newUser.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setNotice(data.message ?? "Failed to create user"); return; }

      const assignedRoom = newUser.roomLabel || "N/A";
      setToast(`User created and assigned to ${assignedRoom} successfully.`);
      setShowCreate(false);
      setNewUser({ name: "", email: "", role: "STUDENT", roomLabel: "", hostelId: "", isActive: true });
      await loadUsers();
    } finally { setSaving(false); }
  };

  const saveSelected = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedUser.name, email: selectedUser.email,
          role: selectedUser.role, isActive: selectedUser.status === "Active",
          hostelId: selectedUser.role === "MANAGEMENT" ? selectedUser.hostelId || null : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setNotice(data.message ?? "Failed to save user"); return; }
      setNotice("User updated."); await loadUsers();
    } finally { setSaving(false); }
  };

  const resetPassword = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: true }),
      });
      const data = await res.json();
      if (!res.ok) { setNotice(data.message ?? "Failed to reset password"); return; }
      setNotice("Password reset to ChangeMe123!");
    } finally { setSaving(false); }
  };

  const deleteSelected = async (idToDelete?: string) => {
    const id = idToDelete ?? selectedUser?.id;
    if (!id) return;
    const uName = users.find(u => u.id === id)?.name ?? "user";
    if (!window.confirm(`Delete user ${uName}?`)) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setNotice(data.message ?? "Failed to delete user"); return; }
      setNotice("User deleted."); await loadUsers();
    } finally { setSaving(false); }
  };

  // Button styles
  const btnPrimary = "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-200 hover:shadow-lg hover:shadow-sky-300 hover:-translate-y-px transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60";
  const btnGhost   = "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-px transition-all duration-150 disabled:opacity-60";
  const btnDanger  = "inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 hover:border-red-300 hover:-translate-y-px transition-all duration-150 disabled:opacity-60";

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} onClose={() => setToast("")} />}

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm text-sky-800">{notice}</p>
          <button onClick={() => setNotice("")} className="text-sky-500 hover:text-sky-700 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        {/* ── Left: Users table ───────────────────────────────────────────── */}
        <section className="surface-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">Users</h2>
            <button className={showCreate ? btnGhost : btnPrimary} onClick={() => setShowCreate(v => !v)}>
              {showCreate ? "Close" : "Add User"}
            </button>
          </div>

          {/* ── Create form ──────────────────────────────────────────────── */}
          {showCreate && (
            <div className="mb-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50/60 to-white p-5 shadow-inner">
              <h3 className="mb-4 text-sm font-bold text-slate-700 uppercase tracking-wider">New User</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {/* Name */}
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input className={fieldCls} placeholder="e.g. Ahmad Razali" value={newUser.name}
                    onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} />
                </div>
                {/* Email */}
                <div>
                  <label className={labelCls}>Email / Student ID *</label>
                  <input className={fieldCls} placeholder="e.g. SW01084131" value={newUser.email}
                    onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
                </div>
                {/* Role */}
                <div>
                  <label className={labelCls}>Role *</label>
                  <select className={fieldCls} value={newUser.role}
                    onChange={e => setNewUser(p => ({ ...p, role: e.target.value as Role, roomLabel: "", hostelId: "" }))}>
                    <option value="STUDENT">Student</option>
                    <option value="MANAGEMENT">Management</option>
                    <option value="IT_STAFF_ADMIN">Admin</option>
                  </select>
                </div>
                {/* Hostel */}
                <div>
                  <label className={labelCls}>Hostel {newUser.role === "IT_STAFF_ADMIN" ? "(N/A)" : "*"}</label>
                  <select className={fieldCls} value={newUser.hostelId} disabled={newUser.role === "IT_STAFF_ADMIN"}
                    onChange={e => setNewUser(p => ({ ...p, hostelId: e.target.value }))}>
                    <option value="">{newUser.role === "IT_STAFF_ADMIN" ? "Not required" : "Select hostel"}</option>
                    {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                {/* Room — searchable combobox, full width */}
                {newUser.role === "STUDENT" && (
                  <div className="md:col-span-2">
                    <label className={labelCls}>Room Assignment * <span className="text-slate-400 font-normal normal-case">(Block-Floor-Unit)</span></label>
                    <RoomCombobox value={newUser.roomLabel} onChange={v => setNewUser(p => ({ ...p, roomLabel: v }))} />
                  </div>
                )}
                {/* Actions */}
                <div className="flex items-center gap-3 pt-1 md:col-span-2">
                  <button className={btnPrimary} onClick={createUser} disabled={saving}>
                    {saving ? "Creating…" : "Create User"}
                  </button>
                  <button className={btnGhost} onClick={() => setShowCreate(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Filters ──────────────────────────────────────────────────── */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search users…"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option>All</option><option>Student</option><option>Management</option><option>Admin</option>
            </select>
            <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option>All</option><option>Active</option><option>Inactive</option>
            </select>
          </div>

          {loading && <p className="text-sm text-slate-500 py-2">Loading users…</p>}

          {/* ── Table ────────────────────────────────────────────────────── */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Profile</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Hostel</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedUsers.map(u => {
                  const hostelName = hostels.find(h => h.id === u.hostelId)?.name ?? "—";
                  return (
                    <tr key={u.id}
                      className={`group relative border-t border-slate-100 transition-colors cursor-pointer ${u.id === selectedId ? "bg-sky-50" : "hover:bg-slate-50"}`}
                      onClick={e => { if ((e.target as HTMLElement).closest("button")) return; setSelectedId(u.id); }}>
                      <td className="py-3 px-4 font-mono text-xs font-bold text-slate-500">{u.id.slice(0, 8)}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{u.name}</span>
                          <span className="text-xs text-slate-500">{u.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{prettyRole(u.role)}</td>
                      <td className="py-3 px-4 text-slate-600">{hostelName}</td>
                      <td className="py-3 px-4">
                        {u.roomLabel
                          ? <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">{u.roomLabel}</span>
                          : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${u.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="relative inline-flex items-center justify-end gap-1">
                          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all"
                            onClick={e => { e.stopPropagation(); setSelectedId(u.id); }} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
                            onClick={e => { e.stopPropagation(); deleteSelected(u.id); }} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="absolute top-full right-0 mt-1 z-10 hidden group-hover:block w-48 rounded-lg bg-slate-800 p-2 text-xs font-medium text-white shadow-xl">
                            <span className="mb-1 block text-slate-400">Last Login</span>{u.lastLogin}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedUsers.length === 0 && !loading && (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400 italic">No users match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <p>Page {currentPage} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button className="rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-50 disabled:opacity-50"
                disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-50 disabled:opacity-50"
                disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ── Right: Edit panel ────────────────────────────────────────────── */}
        <section className="h-fit surface-card p-5 sticky top-20">
          <h2 className="mb-4 text-base font-bold text-slate-900">User Detail / Edit</h2>
          {!selectedUser ? (
            <p className="text-sm text-slate-500 italic">Select a user from the table to edit.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div><label className={labelCls}>User ID</label>
                <input className={`${fieldCls} bg-slate-50`} value={selectedUser.id} readOnly /></div>
              <div><label className={labelCls}>Name</label>
                <input className={fieldCls} value={selectedUser.name}
                  onChange={e => updateSelected({ name: e.target.value })} /></div>
              <div><label className={labelCls}>Email</label>
                <input className={fieldCls} value={selectedUser.email}
                  onChange={e => updateSelected({ email: e.target.value })} /></div>
              <div><label className={labelCls}>Role</label>
                <select className={fieldCls} value={selectedUser.role}
                  onChange={e => updateSelected({ role: e.target.value as Role, hostelId: "" })}>
                  <option value="STUDENT">Student</option>
                  <option value="MANAGEMENT">Management</option>
                  <option value="IT_STAFF_ADMIN">Admin</option>
                </select></div>
              {selectedUser.role === "MANAGEMENT" && (
                <div><label className={labelCls}>Hostel</label>
                  <select className={fieldCls} value={selectedUser.hostelId}
                    onChange={e => updateSelected({ hostelId: e.target.value })}>
                    <option value="">Select hostel</option>
                    {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select></div>
              )}
              {selectedUser.roomLabel && (
                <div><label className={labelCls}>Assigned Room</label>
                  <input className={`${fieldCls} bg-slate-50 font-mono font-bold`} value={selectedUser.roomLabel} readOnly /></div>
              )}
              <div><label className={labelCls}>Status</label>
                <select className={fieldCls} value={selectedUser.status}
                  onChange={e => updateSelected({ status: e.target.value as "Active" | "Inactive" })}>
                  <option>Active</option><option>Inactive</option>
                </select></div>
              <div><label className={labelCls}>Last Login</label>
                <input className={`${fieldCls} bg-slate-50`} value={selectedUser.lastLogin} readOnly /></div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button className={btnPrimary} onClick={saveSelected} disabled={saving}>Save</button>
                <button className={btnGhost}   onClick={resetPassword} disabled={saving}>Reset Password</button>
                <button className={btnDanger}  onClick={() => deleteSelected()} disabled={saving}>Delete</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
