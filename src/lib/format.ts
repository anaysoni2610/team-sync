const DAY = 86_400_000;

export function toLocalInputString(isoStr: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value -> ISO string (or null when cleared) */
export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days from today (negative = past). */
export function daysFromToday(iso: string) {
  return Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / DAY);
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Today, 3:00 PM" · "Tomorrow, 9:00 AM" · "Fri, 2:00 PM" · "Oct 30, 2:00 PM" */
export function formatDue(iso: string) {
  const days = daysFromToday(iso);
  const time = formatTime(iso);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days === -1) return `Yesterday, ${time}`;
  if (days > 1 && days < 7) return `${new Date(iso).toLocaleDateString('en-US', { weekday: 'short' })}, ${time}`;
  return `${formatShortDate(iso)}, ${time}`;
}

/** Under 24h: real elapsed hours ("in 5h", "3h late"). Beyond: calendar days ("in 3 days", "2 days late"). */
export function relativeDue(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const hours = Math.floor(Math.abs(diff) / 3_600_000);
  if (hours < 24) {
    if (hours === 0) return diff < 0 ? 'under 1h late' : 'within the hour';
    return diff < 0 ? `${hours}h late` : `in ${hours}h`;
  }
  const days = Math.abs(daysFromToday(iso));
  const label = `${days} day${days === 1 ? '' : 's'}`;
  return diff < 0 ? `${label} late` : `in ${label}`;
}

// Muted, distinguishable hues for subject tags (text, background).
const SUBJECT_HUES = [
  ['#2F5E9E', '#E7EEF8'],
  ['#8A4B9C', '#F3E9F6'],
  ['#276B43', '#E4F2E9'],
  ['#A3561C', '#F8ECE0'],
  ['#1F6F78', '#E1F1F2'],
  ['#9C3D5A', '#F7E6EC'],
] as const;

export function subjectColor(subject: string | null) {
  if (!subject) return { color: '#5F665F', background: '#EFEBE1' };
  let h = 0;
  for (const ch of subject.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [color, background] = SUBJECT_HUES[h % SUBJECT_HUES.length];
  return { color, background };
}
