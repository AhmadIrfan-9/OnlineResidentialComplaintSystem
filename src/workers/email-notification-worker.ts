import { redisServiceProvider } from "../lib/redis";
import { sendSmtpEmail } from "../lib/email/smtp";

const pollIntervalMs = Number.parseInt(process.env.EMAIL_WORKER_POLL_MS ?? "1500", 10);
let shuttingDown = false;

const renderHtml = (body: string): string =>
  `<html><body><pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${body}</pre></body></html>`;

const processQueue = async () => {
  while (!shuttingDown) {
    try {
      const payload = await redisServiceProvider.dequeueEmailNotification();
      if (!payload) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        continue;
      }

      await sendSmtpEmail({
        to: payload.to,
        subject: payload.subject,
        text: payload.body,
        html: payload.meta?.html ?? renderHtml(payload.body),
      });
      console.log(`[EmailWorker] Delivered notification to ${payload.to}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[EmailWorker] Processing error:", message);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
};

const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await redisServiceProvider.disconnect();
  } catch {
    // no-op
  }
  process.exit(0);
};

const bootstrap = async () => {
  await redisServiceProvider.connect();
  console.log("[EmailWorker] Connected to Redis. Waiting for queued notifications...");
  await processQueue();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[EmailWorker] Fatal startup error:", message);
  process.exit(1);
});
