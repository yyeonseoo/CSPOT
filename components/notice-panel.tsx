import { useState } from "react";
import { nowIso } from "@/lib/format";
import { createAudit } from "@/lib/local-data";
import { uid } from "@/lib/utils";
import type { AppData, ClubUser, Notice } from "@/types/domain";
import { DataList, Field, Panel, PrimaryButton, TextArea, TwoColumn } from "@/components/ui";

export function NoticePanel({ data, currentUser, persist, admin = false }: { data: AppData; currentUser: ClubUser; persist: (data: AppData) => void; admin?: boolean }) {
  const [form, setForm] = useState({ title: "", content: "", pinned: false });
  const visibleNotices = admin ? data.notices : data.notices.filter((notice) => notice.type !== "PERFORMANCE" || !notice.targetPerformanceId || data.performances.find((performance) => performance.id === notice.targetPerformanceId)?.memberIds?.includes(currentUser.id));

  function addNotice() {
    if (!form.title || !admin) return;
    const createdAt = nowIso();
    const notice: Notice = { id: uid("notice"), type: "GENERAL", title: form.title, content: form.content, pinned: form.pinned, createdBy: currentUser.id, createdAt, updatedAt: createdAt };
    persist({ ...data, notices: [...data.notices, notice], auditLogs: [...data.auditLogs, createAudit(currentUser, "CREATE_NOTICE", "notices", notice.id, notice)] });
    setForm({ title: "", content: "", pinned: false });
  }

  return (
    <TwoColumn>
      {admin && <Panel title="공지 작성"><div className="space-y-3"><Field label="제목" value={form.title} onChange={(value) => setForm({ ...form, title: value })} /><TextArea label="내용" value={form.content} onChange={(value) => setForm({ ...form, content: value })} /><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> 고정</label><PrimaryButton onClick={addNotice}>작성</PrimaryButton></div></Panel>}
      <DataList title="공지" items={visibleNotices.map((notice) => ({ id: notice.id, title: notice.pinned ? `[고정] ${notice.title}` : notice.title, meta: notice.content }))} />
    </TwoColumn>
  );
}
