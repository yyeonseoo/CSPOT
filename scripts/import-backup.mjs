// 브라우저에서 받은 백업 파일(관리자 > 마이 > 백업 내보내기)을 Supabase에 한 번 올린다.
// 사용: node --env-file=.env.local scripts/import-backup.mjs club-scheduler-backup-2026-10-01.json
import { readFileSync } from "node:fs";

const COLLECTIONS = ["teams", "users", "performances", "songs", "songMembers", "archiveSongs", "schedules", "surveys", "availabilityResponses", "practiceCandidates", "notices", "auditLogs"];
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const file = process.argv[2];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error(".env.local에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
if (!file) throw new Error("백업 파일 경로를 넣어주세요.");

const parsed = JSON.parse(readFileSync(file, "utf8"));
const data = parsed.data ?? parsed;
const updatedAt = new Date().toISOString();
const rows = COLLECTIONS.flatMap((collection) => (data[collection] ?? []).map((item) => ({ collection, id: item.id, data: item, updated_at: updatedAt })));

for (let index = 0; index < rows.length; index += 500) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/records?on_conflict=collection,id`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      // 새 secret 키(sb_secret_...)는 apikey 헤더만, 예전 service_role 키는 Authorization도 필요
      ...(SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_") ? {} : { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows.slice(index, index + 500)),
  });
  if (!response.ok) throw new Error(`업로드 실패: ${response.status} ${await response.text()}`);
}

for (const collection of COLLECTIONS) console.log(`${collection}: ${(data[collection] ?? []).length}`);
console.log(`총 ${rows.length}건 업로드 완료`);
