"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type TabKey = "categories" | "departments" | "sla" | "email";

interface CategoryRow {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  affectedComplaints: number;
}

interface DepartmentRow {
  id: string;
  name: string;
  email: string;
}

interface SlaSetting {
  safeThresholdDays: number;
  warningThresholdDays: number;
  reminderFrequencyDays: number;
  routineTargetHours: number;
  urgentTargetHours: number;
  emergencyTargetHours: number;
}

interface TemplateRow {
  id: string;
  key: "submission" | "status_update" | "escalation_alert";
  name: string;
  subject: string;
  html: string;
}

const tabButton = (active: boolean): string =>
  `rounded-full px-4 py-2 text-sm font-medium ${
    active
      ? "bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-200"
      : "border border-slate-200 bg-white text-slate-700 hover:bg-sky-50"
  }`;

export function ConfigurationManagementClient() {
  const [tab, setTab] = useState<TabKey>("categories");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [sla, setSla] = useState<SlaSetting>({
    safeThresholdDays: 14,
    warningThresholdDays: 30,
    reminderFrequencyDays: 14,
    routineTargetHours: 72,
    urgentTargetHours: 24,
    emergencyTargetHours: 4,
  });
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [newDepartment, setNewDepartment] = useState({
    name: "",
    email: "",
  });

  const [showDelete, setShowDelete] = useState(false);
  const [targetDelete, setTargetDelete] = useState<CategoryRow | null>(null);
  const [emailTemplate, setEmailTemplate] = useState<"submission" | "status_update" | "escalation_alert">("submission");

  const activeTemplate = useMemo(
    () => templates.find((t) => t.key === emailTemplate),
    [emailTemplate, templates]
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, d, s, t] = await Promise.all([
        fetch("/api/admin/categories"),
        fetch("/api/admin/departments"),
        fetch("/api/admin/sla"),
        fetch("/api/admin/templates"),
      ]);

      const cData = await c.json();
      const dData = await d.json();
      const sData = await s.json();
      const tData = await t.json();

      setCategories(
        (cData.categories ?? []).map((x: { id: string; name: string; description: string; isActive: boolean }) => ({
          ...x,
          affectedComplaints: 0,
        }))
      );
      setDepartments(dData.departments ?? []);
      setSla({
        safeThresholdDays: sData.setting?.safeThresholdDays ?? 14,
        warningThresholdDays: sData.setting?.warningThresholdDays ?? 30,
        reminderFrequencyDays: sData.setting?.reminderFrequencyDays ?? 14,
        routineTargetHours: sData.setting?.routineTargetHours ?? 72,
        urgentTargetHours: sData.setting?.urgentTargetHours ?? 24,
        emergencyTargetHours: sData.setting?.emergencyTargetHours ?? 4,
      });
      setTemplates(tData.templates ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const createCategory = async () => {
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newCategory, isActive: true }),
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.message ?? "Failed to create category");
      return;
    }
    setNewCategory({ name: "", description: "" });
    setNotice("Category created.");
    await loadAll();
  };

  const updateCategory = async (id: string, patch: Partial<CategoryRow>) => {
    const response = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: patch.name,
        description: patch.description,
        isActive: patch.isActive,
      }),
    });
    if (!response.ok) {
      const data = await response.json();
      setNotice(data.message ?? "Failed to update category");
      return;
    }
    setNotice("Category updated.");
    await loadAll();
  };

  const confirmDelete = async () => {
    if (!targetDelete) return;
    const response = await fetch(`/api/admin/categories/${targetDelete.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.message ?? "Failed to delete category");
      return;
    }
    setShowDelete(false);
    setTargetDelete(null);
    setNotice("Category deleted.");
    await loadAll();
  };

  const createDepartment = async () => {
    const response = await fetch("/api/admin/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDepartment),
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.message ?? "Failed to create department");
      return;
    }
    setNewDepartment({
      name: "",
      email: "",
    });
    setNotice("Department created.");
    await loadAll();
  };

  const saveSla = async () => {
    const response = await fetch("/api/admin/sla", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sla),
    });
    const data = await response.json();
    setNotice(response.ok ? "SLA settings saved." : data.message ?? "Failed to save SLA settings");
    if (response.ok) await loadAll();
  };

  const saveTemplate = async () => {
    if (!activeTemplate) return;
    const response = await fetch("/api/admin/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activeTemplate),
    });
    const data = await response.json();
    setNotice(response.ok ? "Template saved." : data.message ?? "Failed to save template");
    if (response.ok) await loadAll();
  };

  const runEscalationNow = async () => {
    const response = await fetch("/api/admin/escalations", { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.message ?? "Failed to queue escalation emails");
      return;
    }
    setNotice(data.message ?? `Escalation queued for ${data.queued ?? 0} complaints.`);
  };

  if (loading) {
    return (
      <div className="surface-card p-4 text-sm text-slate-600">
        Loading configuration...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap gap-2">
        <button className={tabButton(tab === "categories")} onClick={() => setTab("categories")}>
          Categories
        </button>
        <button className={tabButton(tab === "departments")} onClick={() => setTab("departments")}>
          Departments
        </button>
        <button className={tabButton(tab === "sla")} onClick={() => setTab("sla")}>
          SLA Settings
        </button>
        <button className={tabButton(tab === "email")} onClick={() => setTab("email")}>
          Email Templates
        </button>
      </div>

      {notice && <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">{notice}</p>}

      {tab === "categories" && (
        <section className="surface-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Categories</h2>
            <div className="flex flex-wrap gap-2">
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Category Name"
                value={newCategory.name}
                onChange={(e) => setNewCategory((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Description"
                value={newCategory.description}
                onChange={(e) => setNewCategory((p) => ({ ...p, description: e.target.value }))}
              />
              <button className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-3 py-2 text-sm text-white" onClick={createCategory}>
                Add Category
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Category Name</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Active/Inactive</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} className="border-t border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{category.name}</td>
                    <td className="py-2 text-slate-600">{category.description}</td>
                    <td className="py-2">
                      <button
                        className={`rounded-full px-2 py-1 text-xs ${
                          category.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                        }`}
                        onClick={() => updateCategory(category.id, { isActive: !category.isActive })}
                      >
                        {category.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                          onClick={() =>
                            updateCategory(category.id, { description: `${category.description} (updated)` })
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                          onClick={() => {
                            setTargetDelete(category);
                            setShowDelete(true);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "departments" && (
        <section className="surface-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Departments</h2>
            <div className="flex flex-wrap gap-2">
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Department"
                value={newDepartment.name}
                onChange={(e) => setNewDepartment((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Email"
                value={newDepartment.email}
                onChange={(e) => setNewDepartment((p) => ({ ...p, email: e.target.value }))}
              />
              <button className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-3 py-2 text-sm text-white" onClick={createDepartment}>
                Add Department
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Department Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{d.name}</td>
                    <td className="py-2 text-slate-600">{d.email}</td>
                    <td className="py-2">
                      <button className="rounded border border-slate-300 px-2 py-1 text-xs">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "sla" && (
        <section className="surface-card p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">SLA Settings</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Safe Threshold (days)", "safeThresholdDays"],
              ["Warning Threshold (days)", "warningThresholdDays"],
              ["Reminder Frequency (days)", "reminderFrequencyDays"],
              ["Routine Target (hours)", "routineTargetHours"],
              ["Urgent Target (hours)", "urgentTargetHours"],
              ["Emergency Target (hours)", "emergencyTargetHours"],
            ].map(([label, key]) => (
              <label key={key} className="space-y-1 text-sm">
                <span>{label}</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={sla[key as keyof SlaSetting]}
                  onChange={(e) =>
                    setSla((s) => ({ ...s, [key]: Number(e.target.value) } as SlaSetting))
                  }
                />
              </label>
            ))}
          </div>
          <button className="mt-4 rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-sm text-white" onClick={saveSla}>
            Save Changes
          </button>
        </section>
      )}

      {tab === "email" && (
        <section className="surface-card p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Email Templates</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Template list</span>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={emailTemplate}
                onChange={(e) =>
                  setEmailTemplate(e.target.value as "submission" | "status_update" | "escalation_alert")
                }
              >
                <option value="submission">Submission Confirmation</option>
                <option value="status_update">Status Update</option>
                <option value="escalation_alert">Escalation Alert</option>
              </select>
            </label>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Placeholder variables: {"{{student_name}}"}, {"{{ticket_id}}"}, {"{{status}}"}
            </div>
          </div>
          {activeTemplate && (
            <>
              <label className="mt-3 block space-y-1 text-sm">
                <span>Subject</span>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={activeTemplate.subject}
                  onChange={(e) =>
                    setTemplates((prev) =>
                      prev.map((t) => (t.key === activeTemplate.key ? { ...t, subject: e.target.value } : t))
                    )
                  }
                />
              </label>
              <label className="mt-3 block space-y-1 text-sm">
                <span>HTML editor</span>
                <textarea
                  className="min-h-48 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                  value={activeTemplate.html}
                  onChange={(e) =>
                    setTemplates((prev) =>
                      prev.map((t) => (t.key === activeTemplate.key ? { ...t, html: e.target.value } : t))
                    )
                  }
                />
              </label>
            </>
          )}
          <div className="mt-3 flex gap-2">
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm">Send Test</button>
            <button className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-sm text-white" onClick={saveTemplate}>
              Save Changes
            </button>
            <button
              className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800"
              onClick={runEscalationNow}
            >
              Trigger Overdue Escalation
            </button>
          </div>
        </section>
      )}

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogTitle>Confirm Delete Category</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this category? This will affect <span className="font-semibold text-slate-800">{targetDelete?.affectedComplaints ?? 0}</span> complaints.
            This action cannot be undone.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setShowDelete(false)}>
              Cancel
            </button>
            <button className="rounded-md bg-red-600 px-3 py-2 text-sm text-white" onClick={confirmDelete}>
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
