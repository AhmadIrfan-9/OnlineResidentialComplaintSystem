import nodemailer from "nodemailer";

export type SendSmtpEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter => {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true";

  if (!host || !user || !pass) {
    throw new Error("SMTP not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.");
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return cachedTransporter;
};

export const sendSmtpEmail = async (input: SendSmtpEmailInput): Promise<void> => {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM ?? "ORCS <no-reply@orcs.local>";
  const to = Array.isArray(input.to) ? input.to[0] : input.to;
  const bcc = Array.isArray(input.to) ? input.to.slice(1) : [];

  await transporter.sendMail({
    from,
    to,
    bcc,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
};
