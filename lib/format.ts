

export const nowIso = () => new Date().toISOString();

export const today = () => toDateKey(new Date());

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

export function toDatetimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

export function sameDay(date: Date, iso: string) {
  const target = new Date(iso);
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth() && date.getDate() === target.getDate();
}

export function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(date);
}

export function formatSongDuration(seconds?: number) {
  if (!seconds || seconds < 1) return "";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatTotalDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours}시간 ${minutes}분 ${remainingSeconds}초`;
  return `${minutes}분 ${String(remainingSeconds).padStart(2, "0")}초`;
}

export function parseSongDuration(value: string) {
  const match = value.trim().match(/^(\d{1,3})(?::([0-5]?\d))?$/);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2] ?? 0);
}

export function getDateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    dates.push(toDateKey(date));
  }
  return dates;
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

export function makeLocalIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

// 학기 키: "2026-1" = 26년 1학기. 1학기 3~8월, 2학기 9~2월.
export function currentTerm(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 9 ? `${year}-2` : month >= 3 ? `${year}-1` : `${year - 1}-2`;
}

export function previousTerm(term: string) {
  const [year, semester] = term.split("-").map(Number);
  return semester === 2 ? `${year}-1` : `${year - 1}-2`;
}

export function termLabel(term: string) {
  const [year, semester] = term.split("-");
  return `${year.slice(2)}년 ${semester}학기`;
}

// 시간 선택 목록 (24시간제). 지금 값이 목록에 없으면(예: 05:44) 함께 넣는다.
export function timeOptions(current = "", step = 10) {
  const times = Array.from({ length: (24 * 60) / step }, (_, index) => minutesToTime(index * step));
  return current && !times.includes(current) ? [...times, current].sort() : times;
}
