import { ConfigurationManagementClient } from "@/components/admin/ConfigurationManagementClient";

export default function AdminConfigurationPage() {
  return (
    <div className="space-y-4">
      <section className="surface-hero p-4">
        <h1 className="text-xl font-semibold text-slate-900">Configuration Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage categories, departments, SLA settings, and email templates.
        </p>
      </section>
      <ConfigurationManagementClient />
    </div>
  );
}
