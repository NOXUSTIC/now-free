// Helpers for Asia/Dhaka local time used across the app.
export const DAY_NAMES_BN = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"];
export const DAY_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function nowInDhaka(): Date {
  // Convert current instant to Dhaka local wall-clock represented as a Date in UTC fields.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
}

export function dhakaDayIndex(d = nowInDhaka()): number {
  return d.getDay(); // 0 = Sunday (BRACU week-start)
}

export function dhakaTimeString(d = nowInDhaka()): string {
  return d.toTimeString().slice(0, 8); // HH:MM:SS
}

export function fmt12(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${period}`;
}

export function isTimeBetween(t: string, start: string, end: string): boolean {
  return t >= start && t < end;
}
