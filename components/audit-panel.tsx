import { formatDateTime } from "@/lib/format";
import type { AppData } from "@/types/domain";
import { DataList, Panel } from "@/components/ui";

export function AuditPanel({ data, onReset }: { data: AppData; onReset: () => void }) {
  return <section className="space-y-5"><Panel title="Audit Log"><button className="rounded-2xl border border-white/80 bg-card px-4 py-3 text-sm font-bold shadow-sm dark:border-white/10" onClick={onReset}>샘플 데이터 초기화</button></Panel><DataList title="관리자 작업 기록" items={data.auditLogs.slice().reverse().map((log) => ({ id: log.id, title: log.action, meta: `${log.targetType}/${log.targetId} · ${formatDateTime(log.createdAt)}` }))} /></section>;
}
