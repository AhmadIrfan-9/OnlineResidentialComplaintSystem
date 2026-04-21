import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { logAudit, requireAdminUser } from "@/lib/admin";

const OPEN_STATUSES = ["PENDING", "IN_PROGRESS"] as const;

const readList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderEscalationHtml = (
  templateHtml: string | null,
  complaints: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: Date;
    hostel: { name: string };
  }>
): string => {
  const tableRows = complaints
    .slice(0, 50)
    .map(
      (item) =>
        `<tr><td>${item.id.slice(0, 8).toUpperCase()}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(
          item.hostel.name
        )}</td><td>${escapeHtml(item.status)}</td><td>${item.createdAt.toISOString().slice(0, 10)}</td></tr>`
    )
    .join("");

  const summaryTable = `<table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Ticket</th><th>Title</th><th>Hostel</th><th>Status</th><th>Submitted</th></tr></thead><tbody>${tableRows}</tbody></table>`;

  if (templateHtml && templateHtml.trim()) {
    return templateHtml
      .replaceAll("{{total_overdue}}", String(complaints.length))
      .replaceAll("{{overdue_table}}", summaryTable)
      .replaceAll("{{generated_at}}", new Date().toISOString());
  }

  return `<p>Escalation alert: unresolved complaints older than 30 days.</p><p>Total overdue: <strong>${complaints.length}</strong></p>${summaryTable}`;
};

export async function POST() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const [staleComplaints, managementUsers, escalationTemplate] = await Promise.all([
    db.complaint.findMany({
      where: {
        status: { in: [...OPEN_STATUSES] },
        createdAt: { lte: cutoff },
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        hostel: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    db.user.findMany({
      where: { role: "MANAGEMENT", isActive: true },
      select: { id: true, email: true, name: true },
    }),
    db.adminEmailTemplate.findUnique({
      where: { key: "escalation_alert" },
      select: { subject: true, html: true },
    }),
  ]);

  if (staleComplaints.length === 0) {
    return NextResponse.json({
      queued: 0,
      recipients: managementUsers.map((u) => u.email),
      message: "No overdue complaints found.",
    });
  }

  // Store escalation notifications for management users.
  if (managementUsers.length > 0) {
    await db.notification.createMany({
      data: staleComplaints.flatMap((complaint) =>
        managementUsers.map((manager) => ({
          userId: manager.id,
          complaintId: complaint.id,
          message: `Escalation alert: complaint ${complaint.id.slice(0, 8).toUpperCase()} has been unresolved for over 30 days.`,
        }))
      ),
      skipDuplicates: true,
    });
  }

  const explicitRecipients = readList(process.env.ESCALATION_EMAIL_TO);
  const managementRecipients = managementUsers.map((u) => u.email).filter(Boolean);
  const recipients = Array.from(new Set([...explicitRecipients, ...managementRecipients]));

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT ?? "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const mailFrom = process.env.SMTP_FROM ?? "ORCS <no-reply@orcs.local>";
  const smtpSecure = process.env.SMTP_SECURE === "true";

  let emailed = 0;
  let emailMessage = "SMTP not configured. Notifications were queued only.";

  if (smtpHost && smtpUser && smtpPass && recipients.length > 0) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const subject =
      escalationTemplate?.subject?.trim() ||
      `[ORCS] Escalation Alert: ${staleComplaints.length} overdue complaints`;
    const html = renderEscalationHtml(escalationTemplate?.html ?? null, staleComplaints);
    const text = `Escalation alert: ${staleComplaints.length} unresolved complaints older than 30 days.`;

    const [first, ...bcc] = recipients;
    await transporter.sendMail({
      from: mailFrom,
      to: first,
      bcc,
      subject,
      html,
      text,
    });
    emailed = recipients.length;
    emailMessage = `Escalation email sent to ${emailed} recipient(s).`;
  } else if (recipients.length === 0) {
    emailMessage = "No escalation recipients found. Notifications were queued only.";
  }

  await logAudit({
    userId: admin.id,
    userName: admin.name ?? "Admin",
    action: "Escalation",
    resource: "OverdueComplaints",
    after: JSON.stringify({
      complaintCount: staleComplaints.length,
      recipients,
      emailed,
    }),
  });

  return NextResponse.json({
    queued: staleComplaints.length,
    recipients,
    emailed,
    message: emailMessage,
  });
}
