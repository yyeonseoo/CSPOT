import { useState } from "react";
import { formatDateTime, nowIso } from "@/lib/format";
import { createAudit } from "@/lib/local-data";
import { uid } from "@/lib/utils";
import type { AppData, ClubUser, Notice } from "@/types/domain";
import { Field, Panel, PrimaryButton, SoftCheckbox, TextArea } from "@/components/ui";

const emptyForm = { title: "", content: "", pinned: false };

export function NoticePanel({ data, currentUser, persist, admin = false }: { data: AppData; currentUser: ClubUser; persist: (data: AppData) => void; admin?: boolean }) {
  const [form, setForm] = useState(emptyForm);
  // 수정 중인 공지 id. 비어 있으면 새 공지 작성
  const [editingId, setEditingId] = useState("");
  const visibleNotices = (admin ? data.notices : data.notices.filter((notice) => notice.type !== "PERFORMANCE" || !notice.targetPerformanceId || data.performances.find((performance) => performance.id === notice.targetPerformanceId)?.memberIds?.includes(currentUser.id)))
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));

  function save() {
    if (!form.title.trim() || !admin) return;
    const now = nowIso();
    if (editingId) {
      persist({
        ...data,
        notices: data.notices.map((notice) => notice.id === editingId ? { ...notice, ...form, title: form.title.trim(), updatedAt: now } : notice),
        auditLogs: [...data.auditLogs, createAudit(currentUser, "UPDATE_NOTICE", "notices", editingId, form)],
      });
    } else {
      const notice: Notice = { id: uid("notice"), type: "GENERAL", title: form.title.trim(), content: form.content, pinned: form.pinned, createdBy: currentUser.id, createdAt: now, updatedAt: now };
      persist({ ...data, notices: [...data.notices, notice], auditLogs: [...data.auditLogs, createAudit(currentUser, "CREATE_NOTICE", "notices", notice.id, notice)] });
    }
    setForm(emptyForm);
    setEditingId("");
  }

  function startEdit(notice: Notice) {
    setEditingId(notice.id);
    setForm({ title: notice.title, content: notice.content, pinned: notice.pinned });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function remove(notice: Notice) {
    if (!window.confirm(`"${notice.title}" 공지를 삭제할까요?`)) return;
    persist({ ...data, notices: data.notices.filter((item) => item.id !== notice.id), auditLogs: [...data.auditLogs, createAudit(currentUser, "DELETE_NOTICE", "notices", notice.id, notice)] });
    if (editingId === notice.id) {
      setEditingId("");
      setForm(emptyForm);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
      {admin && (
        <Panel title={editingId ? "공지 수정" : "공지 작성"}>
          <div className="space-y-3">
            <Field label="제목" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
            <TextArea label="내용" value={form.content} onChange={(value) => setForm({ ...form, content: value })} />
            <SoftCheckbox checked={form.pinned} label="캘린더에 고정" onToggle={() => setForm({ ...form, pinned: !form.pinned })} />
            <div className="flex gap-2">
              {editingId && <button type="button" className="shrink-0 rounded-full bg-background px-5 py-3 text-sm font-semibold" onClick={() => { setEditingId(""); setForm(emptyForm); }}>취소</button>}
              <PrimaryButton onClick={save} disabled={!form.title.trim()}>{editingId ? "수정 저장" : "작성"}</PrimaryButton>
            </div>
          </div>
        </Panel>
      )}
      <Panel title="공지">
        <div className="space-y-2">
          {visibleNotices.length === 0 && <p className="text-sm text-muted-foreground">공지가 없습니다.</p>}
          {visibleNotices.map((notice) => (
            <article key={notice.id} className="rounded-2xl bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words font-semibold">
                  {notice.pinned && <span className="mr-1.5 rounded-full bg-primary px-2 py-0.5 align-middle text-[11px] font-semibold text-primary-foreground">고정</span>}
                  {notice.title}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(notice.createdAt)}</span>
              </div>
              {notice.content && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{notice.content}</p>}
              {admin && (
                <div className="mt-3 flex gap-2">
                  <button type="button" className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground" onClick={() => startEdit(notice)}>수정</button>
                  <button type="button" className="rounded-full bg-card px-4 py-1.5 text-xs font-semibold text-destructive" onClick={() => remove(notice)}>삭제</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}
