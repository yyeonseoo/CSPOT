import { formatDateTime } from "@/lib/format";
import type { AppData } from "@/types/domain";
import { DataList } from "@/components/ui";

export function AuditPanel({ data }: { data: AppData }) {
  return <section className="space-y-5"><DataList title="관리자 작업 기록" items={data.auditLogs.slice().reverse().map((log) => ({ id: log.id, title: log.action, meta: `${log.targetType}/${log.targetId} · ${formatDateTime(log.createdAt)}` }))} /></section>;
}
