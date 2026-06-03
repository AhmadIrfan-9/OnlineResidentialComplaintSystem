"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Trash2, Search, ChevronLeft, ChevronRight, CheckCircle2, X, UserPlus, Copy, KeyRound, Pencil } from "lucide-react";

type Role = "STUDENT" | "MANAGEMENT" | "IT_STAFF_ADMIN";
type UserRow = {
  id: string; name: string; email: string; role: Role;
  hostelId: string; roomLabel: string; status: "Active" | "Inactive"; lastLogin: string;
};
type HostelOption = { id: string; name: string };
const prettyRole = (role: Role) =>
  role === "IT_STAFF_ADMIN" ? "Admin" : role === "MANAGEMENT" ? "Management" : "Student";

const formatLastLogin = (v: string | null) => (!v ? "Never" : new Date(v).toLocaleString());



const BLOCKS = ["C1", "C2", "C3"];
const FLOORS = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, "0"));
const UNITS  = Array.from({ length: 8  }, (_, i) => String(i + 1).padStart(2, "0"));

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-9999 flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
      <p className="text-sm font-semibold text-slate-800">{message}</p>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600 transition-colors">
        <X className="h-4 w-4" />
      </button>
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

export function UserManagementClient({ hostels }: { hostels: HostelOption[] }) {
  const [roleFilter,    setRoleFilter]    = useState("All");
  const [statusFilter,  setStatusFilter]  = useState("All");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [currentPage,   setCurrentPage]   = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [users,       setUsers]       = useState<UserRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [notice,      setNotice]      = useState("");
  const [toast,       setToast]       = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [targetDelete, setTargetDelete] = useState<UserRow | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [showCreate,  setShowCreate]  = useState(false);
  const [mounted,     setMounted]     = useState(false);
  const [newUser, setNewUser] = useState({
    name: "", email: "", role: "STUDENT" as Role,
    roomLabel: "", hostelId: "", isActive: true,
  });
  const [roomBlock, setRoomBlock] = useState("");
  const [roomFloor, setRoomFloor] = useState("");
  const [roomUnit, setRoomUnit] = useState("");

  const [showEdit,    setShowEdit]    = useState(false);
  const [editUser,    setEditUser]    = useState<{
    id: string;
    name: string;
    email: string;
    role: Role;
    hostelId: string;
    roomLabel: string;
    isActive: boolean;
    resetPassword?: boolean;
  } | null>(null);
  const [editBlock,   setEditBlock]   = useState("");
  const [editFloor,   setEditFloor]   = useState("");
  const [editUnit,    setEditUnit]    = useState("");

  useEffect(() => {
    if (roomBlock && roomFloor && roomUnit) {
      setNewUser(p => ({ ...p, roomLabel: `${roomBlock}-${roomFloor}-${roomUnit}` }));
    } else {
      setNewUser(p => ({ ...p, roomLabel: "" }));
    }
  }, [roomBlock, roomFloor, roomUnit]);

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

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/users", { cache: "no-store" });

      if (!res.ok) {
        setNotice(`Failed to load users: ${res.statusText}`);
        return;
      }

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      const next = (data.users ?? []).map(mapApiUser);
      setUsers(next);
    } catch (error) {
      console.error("Fetch Error:", error);
      setNotice("A network error occurred while loading users.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const createUser = async () => {
    if (!newUser.name || !newUser.email) { setNotice("Name and email are required."); return; }
    if (newUser.role === "MANAGEMENT" && !newUser.hostelId) { setNotice("Hostel is required for management."); return; }
    if (newUser.role === "STUDENT"    && !newUser.roomLabel)  { setNotice("Room is required for student."); return; }
    if (!adminPassword) { setNotice("Admin password is required."); return; }

    setSaving(true);
    try {
      const res  = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword,
        },
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

      setShowCreate(false);
      setNewUser({ name: "", email: "", role: "STUDENT", roomLabel: "", hostelId: "", isActive: true });
      setRoomBlock(""); setRoomFloor(""); setRoomUnit("");
      setAdminPassword("");
      setToast("User created successfully.");
      await loadUsers();
    } finally { setSaving(false); }
  };

  const startEdit = (user: UserRow) => {
    setAdminPassword("");
    setNotice("");
    setEditUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      hostelId: user.hostelId || "",
      roomLabel: user.roomLabel || "",
      isActive: user.status === "Active",
      resetPassword: false,
    });
    if (user.role === "STUDENT" && user.roomLabel) {
      const parts = user.roomLabel.split("-");
      if (parts.length === 3) {
        setEditBlock(parts[0]);
        setEditFloor(parts[1]);
        setEditUnit(parts[2]);
      } else {
        setEditBlock("");
        setEditFloor("");
        setEditUnit("");
      }
    } else {
      setEditBlock("");
      setEditFloor("");
      setEditUnit("");
    }
    setShowEdit(true);
  };

  const updateUser = async () => {
    if (!editUser) return;
    if (!editUser.name || !editUser.email) { setNotice("Name and email are required."); return; }
    if (editUser.role === "MANAGEMENT" && !editUser.hostelId) { setNotice("Hostel is required for management."); return; }
    if (editUser.role === "STUDENT" && (!editBlock || !editFloor || !editUnit)) { setNotice("Room is required for student."); return; }
    if (!adminPassword) { setNotice("Admin password is required."); return; }

    setSaving(true);
    try {
      const roomLabel = editUser.role === "STUDENT" ? `${editBlock}-${editFloor}-${editUnit}` : undefined;
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword,
        },
        body: JSON.stringify({
          name: editUser.name,
          email: editUser.email,
          role: editUser.role,
          isActive: editUser.isActive,
          hostelId: editUser.role === "IT_STAFF_ADMIN" ? null : (editUser.hostelId || null),
          roomLabel,
          resetPassword: editUser.resetPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setNotice(data.message ?? "Failed to update user"); return; }

      setShowEdit(false);
      setEditUser(null);
      setAdminPassword("");
      setToast("User updated successfully.");
      await loadUsers();
    } catch (error) {
      console.error(error);
      setNotice("An error occurred while updating user.");
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    setTargetDelete(user);
    setAdminPassword("");
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (!targetDelete) return;
    if (!adminPassword) {
      setNotice("Admin password is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${targetDelete.id}`, {
        method: "DELETE",
        headers: { "X-Admin-Password": adminPassword }
      });
      const data = await res.json();
      if (!res.ok) { setNotice(data.message ?? "Failed to delete user"); return; }
      setNotice("User deleted."); 
      setShowDelete(false);
      setTargetDelete(null);
      await loadUsers();
    } finally { setSaving(false); }
  };

  // Button styles
  const btnPrimary = "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-200 hover:shadow-lg hover:shadow-sky-300 hover:-translate-y-px transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60";
  const btnGhost   = "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-px transition-all duration-150 disabled:opacity-60";

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

      {/* ── Add User modal ───────────────────────────────────────────────── */}
      {mounted && showCreate && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="mx-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">New User</h2>
              </div>
              <button type="button" onClick={() => { setShowCreate(false); setAdminPassword(""); setNotice(""); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Modal body */}
            <div className="px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input className={fieldCls} placeholder="e.g. Ahmad Razali" value={newUser.name}
                    onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Student/Staff Email *</label>
                  <input className={fieldCls} placeholder="e.g. SW01084216@student.uniten.edu.my" value={newUser.email}
                    onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Role *</label>
                  <select className={fieldCls} value={newUser.role}
                    onChange={e => setNewUser(p => ({ ...p, role: e.target.value as Role, roomLabel: "", hostelId: "" }))}>
                    <option value="STUDENT">Student</option>
                    <option value="MANAGEMENT">Management</option>
                    <option value="IT_STAFF_ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Residency {newUser.role === "IT_STAFF_ADMIN" ? "(N/A)" : "*"}</label>
                  <select className={fieldCls} value={newUser.hostelId} disabled={newUser.role === "IT_STAFF_ADMIN"}
                    onChange={e => setNewUser(p => ({ ...p, hostelId: e.target.value }))}>
                    <option value="">{newUser.role === "IT_STAFF_ADMIN" ? "Not required" : "Select hostel"}</option>
                    {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                {newUser.role === "STUDENT" && (
                  <div className="md:col-span-2">
                    <label className={labelCls}>Room Assignment * <span className="text-slate-400 font-normal normal-case">(Block-Floor-Unit)</span></label>
                    <div className="flex flex-row gap-2">
                      <select className={fieldCls} value={roomBlock} onChange={e => setRoomBlock(e.target.value)}>
                        <option value="">Block</option>
                        {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <select className={fieldCls} value={roomFloor} onChange={e => setRoomFloor(e.target.value)}>
                        <option value="">Floor</option>
                        {FLOORS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <select className={fieldCls} value={roomUnit} onChange={e => setRoomUnit(e.target.value)}>
                        <option value="">Unit</option>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div className="md:col-span-2 border-t border-slate-100 pt-4">
                  <label className={labelCls}>Admin Password * <span className="text-slate-400 font-normal normal-case">(Required to verify changes)</span></label>
                  <input type="password" className={fieldCls} placeholder="Enter your admin password" value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)} />
                </div>
                <div className="flex items-center gap-3 pt-1 md:col-span-2">
                  <button className={btnPrimary} onClick={createUser}
                    disabled={saving || !adminPassword || (newUser.role === "STUDENT" && (!roomBlock || !roomFloor || !roomUnit))}>
                    {saving ? "Creating…" : "Create User"}
                  </button>
                  <button className={btnGhost} onClick={() => { setShowCreate(false); setAdminPassword(""); setNotice(""); }}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) /* end add-user portal */}

      {/* ── Edit User modal ───────────────────────────────────────────────── */}
      {mounted && showEdit && editUser && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="mx-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">Edit User</h2>
              </div>
              <button type="button" onClick={() => { setShowEdit(false); setEditUser(null); setAdminPassword(""); setNotice(""); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Modal body */}
            <div className="px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input className={fieldCls} placeholder="e.g. Ahmad Razali" value={editUser.name}
                    onChange={e => setEditUser(p => p ? { ...p, name: e.target.value } : null)} />
                </div>
                <div>
                  <label className={labelCls}>Student/Staff Email *</label>
                  <input className={fieldCls} placeholder="e.g. SW01084216@student.uniten.edu.my" value={editUser.email}
                    onChange={e => setEditUser(p => p ? { ...p, email: e.target.value } : null)} />
                </div>
                <div>
                  <label className={labelCls}>Role *</label>
                  <select className={fieldCls} value={editUser.role}
                    onChange={e => {
                      const nextRole = e.target.value as Role;
                      setEditUser(p => p ? {
                        ...p,
                        role: nextRole,
                        roomLabel: nextRole === "STUDENT" ? p.roomLabel : "",
                        hostelId: nextRole === "IT_STAFF_ADMIN" ? "" : p.hostelId,
                      } : null);
                    }}>
                    <option value="STUDENT">Student</option>
                    <option value="MANAGEMENT">Management</option>
                    <option value="IT_STAFF_ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Residency {editUser.role === "IT_STAFF_ADMIN" ? "(N/A)" : "*"}</label>
                  <select className={fieldCls} value={editUser.hostelId} disabled={editUser.role === "IT_STAFF_ADMIN"}
                    onChange={e => setEditUser(p => p ? { ...p, hostelId: e.target.value } : null)}>
                    <option value="">{editUser.role === "IT_STAFF_ADMIN" ? "Not required" : "Select hostel"}</option>
                    {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                {editUser.role === "STUDENT" && (
                  <div className="md:col-span-2">
                    <label className={labelCls}>Room Assignment * <span className="text-slate-400 font-normal normal-case">(Block-Floor-Unit)</span></label>
                    <div className="flex flex-row gap-2">
                      <select className={fieldCls} value={editBlock} onChange={e => setEditBlock(e.target.value)}>
                        <option value="">Block</option>
                        {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <select className={fieldCls} value={editFloor} onChange={e => setEditFloor(e.target.value)}>
                        <option value="">Floor</option>
                        {FLOORS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <select className={fieldCls} value={editUnit} onChange={e => setEditUnit(e.target.value)}>
                        <option value="">Unit</option>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div>
                  <label className={labelCls}>Status *</label>
                  <select className={fieldCls} value={editUser.isActive ? "Active" : "Inactive"}
                    onChange={e => setEditUser(p => p ? { ...p, isActive: e.target.value === "Active" } : null)}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={!!editUser.resetPassword}
                      onChange={e => setEditUser(p => p ? { ...p, resetPassword: e.target.checked } : null)} />
                    Reset Password to <span className="font-mono text-xs font-bold text-red-600 bg-red-50 px-1 py-0.5 rounded">ChangeMe123!</span>
                  </label>
                </div>
                <div className="md:col-span-2 border-t border-slate-100 pt-4">
                  <label className={labelCls}>Admin Password * <span className="text-slate-400 font-normal normal-case">(Required to verify changes)</span></label>
                  <input type="password" className={fieldCls} placeholder="Enter your admin password" value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)} />
                </div>
                <div className="flex items-center gap-3 pt-1 md:col-span-2">
                  <button className={btnPrimary} onClick={updateUser}
                    disabled={saving || !adminPassword || (editUser.role === "STUDENT" && (!editBlock || !editFloor || !editUnit))}>
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                  <button className={btnGhost} onClick={() => { setShowEdit(false); setEditUser(null); setAdminPassword(""); setNotice(""); }}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <section className="surface-card p-5">
        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
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
          <div className="ml-auto">
            <button className={btnPrimary} onClick={() => setShowCreate(true)}>
              Add User
            </button>
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Profile</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Hostel</th>
                <th className="py-3 px-4">Room</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="h-4 w-32 bg-slate-200 rounded"></div>
                        <div className="h-3 w-40 bg-slate-200 rounded"></div>
                      </div>
                    </td>
                    <td className="py-3 px-4"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                    <td className="py-3 px-4"><div className="h-6 w-16 bg-slate-200 rounded-full"></div></td>
                    <td className="py-3 px-4 text-right"><div className="inline-block h-6 w-16 bg-slate-200 rounded"></div></td>
                  </tr>
                ))
              ) : (
                paginatedUsers.map(u => {
                  const hostelName = hostels.find(h => h.id === u.hostelId)?.name ?? "—";
                  return (
                    <tr key={u.id} className="group relative border-t border-slate-100 transition-colors hover:bg-slate-50">
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
                          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
                            onClick={e => { e.stopPropagation(); startEdit(u); }} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
                            onClick={e => { e.stopPropagation(); deleteUser(u.id); }} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="absolute top-full right-0 mt-1 z-10 hidden group-hover:block w-48 rounded-lg bg-slate-800 p-2 text-xs font-medium text-white shadow-xl">
                            <span className="mb-1 block text-slate-400">Last Login</span>{u.lastLogin}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {paginatedUsers.length === 0 && !loading && (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400 italic">No users match the current filters.</td></tr>
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
      {/* ── Delete User Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogTitle>Confirm Delete User</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the user <span className="font-semibold text-slate-800">{targetDelete?.name}</span>? This action is permanent and cannot be undone.
          </DialogDescription>
          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Admin Password to Verify</label>
              <input
                type="password"
                placeholder="Enter your admin password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                onClick={() => setShowDelete(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                onClick={confirmDelete}
                disabled={saving || !adminPassword}
              >
                {saving ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
