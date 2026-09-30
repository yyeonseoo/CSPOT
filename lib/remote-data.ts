import type { AppData } from "@/types/domain";

// 서버 DB(Supabase)와 주고받는 부분. 한 항목 = records 테이블 한 줄.
export const COLLECTIONS = [
  "teams",
  "users",
  "performances",
  "songs",
  "songMembers",
  "archiveSongs",
  "schedules",
  "surveys",
  "availabilityResponses",
  "practiceCandidates",
  "notices",
  "auditLogs",
] as const satisfies readonly (keyof AppData)[];

export const CLUB_CODE_KEY = "club-scheduler-club-code";

export type RecordRow = { collection: string; id: string; data: unknown };
export type DataDiff = { upserts: RecordRow[]; deletes: Array<{ collection: string; id: string }> };

export function rowsToData(rows: RecordRow[]): AppData {
  const data = Object.fromEntries(COLLECTIONS.map((collection) => [collection, [] as unknown[]]));
  rows.forEach((row) => data[row.collection]?.push(row.data));
  return data as unknown as AppData;
}

// 바뀐 항목만 보낸다. 다른 사람이 동시에 다른 항목을 고쳐도 서로 덮어쓰지 않는다.
export function diffData(prev: AppData, next: AppData): DataDiff {
  const diff: DataDiff = { upserts: [], deletes: [] };
  for (const collection of COLLECTIONS) {
    const before = new Map((prev[collection] as Array<{ id: string }>).map((item) => [item.id, JSON.stringify(item)]));
    const after = next[collection] as Array<{ id: string }>;
    for (const item of after) {
      if (before.get(item.id) !== JSON.stringify(item)) diff.upserts.push({ collection, id: item.id, data: item });
    }
    const afterIds = new Set(after.map((item) => item.id));
    for (const id of before.keys()) {
      if (!afterIds.has(id)) diff.deletes.push({ collection, id });
    }
  }
  return diff;
}

// "local": 서버에 DB 설정이 없음(브라우저 저장소로 동작), "unauthorized": 동아리 코드가 틀림
export async function loadRemote(code: string): Promise<AppData | "local" | "unauthorized"> {
  const response = await fetch("/api/data", { headers: { "x-club-code": code }, cache: "no-store" });
  if (response.status === 503) return "local";
  if (response.status === 401) return "unauthorized";
  if (!response.ok) throw new Error(`load failed: ${response.status}`);
  const { rows } = (await response.json()) as { rows: RecordRow[] };
  return rowsToData(rows);
}

export async function saveRemote(code: string, diff: DataDiff) {
  const response = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json", "x-club-code": code }, body: JSON.stringify(diff) });
  if (!response.ok) throw new Error(`save failed: ${response.status}`);
}
