const MYT_LOCALE = "en-MY";
const MYT_TZ = "Asia/Kuala_Lumpur";

/** Full date + time in Malaysia Time: e.g. "21 May 2026, 09:45 AM" */
export function formatDateTimeMYT(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(MYT_LOCALE, {
    timeZone: MYT_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Date only in MYT: e.g. "21 May 2026" */
export function formatDateMYT(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(MYT_LOCALE, {
    timeZone: MYT_TZ,
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Relative label used in report headers: e.g. "21 May 2026, 09:45 AM (MYT)" */
export function formatReportTimestampMYT(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${formatDateTimeMYT(d)} (MYT)`;
}
