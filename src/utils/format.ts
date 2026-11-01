/** "14:05" (or "2:05 PM", following the phone's settings). Used under chat messages. */
export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Today 2:05 PM", "Yesterday 9:12 AM", "Mon 2:05 PM", "Sep 12, 2:05 PM" (plus the year if not this one). */
export function formatChatTimestamp(iso: string): string {
  const date = new Date(iso);
  const time = formatClockTime(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (daysAgo === 0) return `Today ${time}`;
  if (daysAgo === 1) return `Yesterday ${time}`;
  if (daysAgo > 1 && daysAgo < 7) return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
  return `${day}, ${time}`;
}

/** "now", "5m", "3h", "2d", or a short date for anything older than a week. */
export function formatRelativeTime(iso: string): string {
  const diffMinutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);

  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** How long until a Blink disappears: "45m left", "5h left", "2d left", or "Expiring" at the end. */
export function formatTimeLeft(iso: string): string {
  const minutes = Math.floor((new Date(iso).getTime() - Date.now()) / 60_000);
  if (minutes < 1) return 'Expiring';
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

/** 950 -> "950", 1_240 -> "1.2K", 3_400_000 -> "3.4M" */
export function formatCount(value: number): string {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${trimDecimal(value / 1_000)}K`;
  return `${trimDecimal(value / 1_000_000)}M`;
}

function trimDecimal(value: number): string {
  return value >= 100 ? Math.floor(value).toString() : value.toFixed(1).replace(/\.0$/, '');
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
