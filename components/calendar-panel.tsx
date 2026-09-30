import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { calendarDays, monthTitle, nowIso, sameDay, toDateKey, toDatetimeLocal, today } from "@/lib/format";
import { createAudit } from "@/lib/local-data";
import { getVisibleSchedules } from "@/lib/schedule";
import { cn, uid } from "@/lib/utils";
import type { AppData, ClubUser, Schedule } from "@/types/domain";
import { CalendarEventPill, NoticeCard, ScheduleRow } from "@/components/items";
import { Field, IconButton, Panel, PrimaryButton } from "@/components/ui";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarPanel({ data, currentUser, adminMode, persist }: { data: AppData; currentUser: ClubUser; adminMode: boolean; persist: (data: AppData) => void }) {
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(today());
  const [showCreate, setShowCreate] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ title: "", startsAt: "", endsAt: "" });
  const [personalTitle, setPersonalTitle] = useState("");
  const [personalStart, setPersonalStart] = useState("18:00");
  const [personalEnd, setPersonalEnd] = useState("19:00");
  const visibleSchedules = useMemo(() => getVisibleSchedules(data, currentUser, adminMode), [adminMode, currentUser, data]);
  const monthDays = calendarDays(month);
  const selectedEvents = visibleSchedules.filter((schedule) => toDateKey(new Date(schedule.startsAt)) === selectedDate);
  const upcoming = visibleSchedules.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 5);
  const pinned = data.notices.filter((notice) => notice.pinned);

  function addPersonalSchedule() {
    if (!personalTitle.trim()) return;
    const createdAt = nowIso();
    const schedule: Schedule = {
      id: uid("schedule"),
      type: "PERSONAL",
      title: personalTitle,
      startsAt: new Date(`${selectedDate}T${personalStart}`).toISOString(),
      endsAt: new Date(`${selectedDate}T${personalEnd}`).toISOString(),
      color: "#AAB2BD",
      ownerUserId: currentUser.id,
      visibility: "PRIVATE",
      status: "CONFIRMED",
      createdBy: currentUser.id,
      createdAt,
      updatedAt: createdAt,
    };
    persist({ ...data, schedules: [...data.schedules, schedule] });
    setPersonalTitle("");
    setShowCreate(false);
  }

  function startEditSchedule(schedule: Schedule) {
    setEditingScheduleId(schedule.id);
    setScheduleForm({ title: schedule.title, startsAt: toDatetimeLocal(schedule.startsAt), endsAt: toDatetimeLocal(schedule.endsAt) });
    setShowCreate(false);
  }

  function saveScheduleEdit() {
    if (!editingScheduleId || !scheduleForm.title.trim()) return;
    const updatedAt = nowIso();
    persist({
      ...data,
      schedules: data.schedules.map((schedule) => schedule.id === editingScheduleId ? { ...schedule, title: scheduleForm.title, startsAt: new Date(scheduleForm.startsAt).toISOString(), endsAt: new Date(scheduleForm.endsAt).toISOString(), updatedAt } : schedule),
      auditLogs: [...data.auditLogs, createAudit(currentUser, "UPDATE_SCHEDULE", "schedules", editingScheduleId, scheduleForm)],
    });
    setEditingScheduleId(null);
  }

  function cancelSchedule(schedule: Schedule) {
    const ok = window.confirm(`${schedule.title} 일정을 취소할까요?`);
    if (!ok) return;
    const restoredCandidates = data.practiceCandidates.map((candidate) => (
      schedule.songId &&
      candidate.songId === schedule.songId &&
      candidate.startsAt === schedule.startsAt &&
      candidate.endsAt === schedule.endsAt &&
      candidate.status === "APPROVED"
        ? { ...candidate, status: "PENDING" as const, reviewedBy: undefined, reviewedAt: undefined, updatedAt: nowIso() }
        : candidate
    ));
    persist({
      ...data,
      schedules: data.schedules.filter((item) => item.id !== schedule.id),
      practiceCandidates: restoredCandidates,
      auditLogs: [...data.auditLogs, createAudit(currentUser, "CANCEL_SCHEDULE", "schedules", schedule.id, schedule)],
    });
    if (editingScheduleId === schedule.id) setEditingScheduleId(null);
  }

  function canEditSchedule(schedule: Schedule) {
    return adminMode || schedule.ownerUserId === currentUser.id;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/84 p-4 shadow-[0_20px_70px_rgba(86,144,183,0.12)] backdrop-blur dark:border-white/10 dark:bg-card/82 sm:p-5">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">Calendar</p>
            <h3 className="text-3xl font-black">{monthTitle(month)}</h3>
          </div>
          <div className="flex items-center gap-2">
            <IconButton label="이전 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></IconButton>
            <button className="rounded-2xl bg-muted/70 px-4 py-3 text-sm font-bold" onClick={() => setMonth(new Date())}>Today</button>
            <IconButton label="다음 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></IconButton>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekdays.map((day) => <div key={day} className="px-2 pb-1 text-center text-xs font-black text-muted-foreground">{day}</div>)}
          {monthDays.map((date) => {
            const dateKey = toDateKey(date);
            const events = visibleSchedules.filter((schedule) => sameDay(date, schedule.startsAt));
            const isCurrentMonth = date.getMonth() === month.getMonth();
            const isToday = sameDay(date, new Date().toISOString());
            const isSelected = selectedDate === dateKey;
            return (
              <button
                key={date.toISOString()}
                className={cn(
                  "min-h-24 rounded-[1.25rem] border bg-card/80 p-2 text-left transition hover:-translate-y-0.5 hover:shadow-lg sm:min-h-30",
                  !isCurrentMonth && "opacity-45",
                  isSelected ? "border-primary/70 ring-4 ring-primary/10" : isToday ? "border-primary/35" : "border-white/80 dark:border-white/10",
                )}
                onClick={() => {
                  setSelectedDate(dateKey);
                  setShowCreate(false);
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className={cn("grid h-7 w-7 place-items-center rounded-full text-sm font-black", isToday && "bg-primary text-primary-foreground")}>{date.getDate()}</span>
                  {events.length > 2 && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">+{events.length - 2}</span>}
                </div>
                <div className="space-y-1.5">
                  {events.slice(0, 2).map((event) => <CalendarEventPill key={event.id} schedule={event} data={data} currentUser={currentUser} />)}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="space-y-5">
        <Panel title={`${selectedDate} 일정`}>
          <div className="mb-4 space-y-2">
            {selectedEvents.length === 0 && <p className="text-sm text-muted-foreground">이 날짜에 등록된 일정이 없습니다.</p>}
            {selectedEvents.map((schedule) => (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                data={data}
                currentUser={currentUser}
                editable={canEditSchedule(schedule)}
                onEdit={() => startEditSchedule(schedule)}
                onCancel={() => cancelSchedule(schedule)}
              />
            ))}
          </div>
          {editingScheduleId && (
            <div className="mb-4 space-y-3 border-t border-white/70 pt-4 dark:border-white/10">
              <Field label="일정 제목" value={scheduleForm.title} onChange={(value) => setScheduleForm({ ...scheduleForm, title: value })} />
              <Field label="시작" type="datetime-local" value={scheduleForm.startsAt} onChange={(value) => setScheduleForm({ ...scheduleForm, startsAt: value })} />
              <Field label="종료" type="datetime-local" value={scheduleForm.endsAt} onChange={(value) => setScheduleForm({ ...scheduleForm, endsAt: value })} />
              <PrimaryButton onClick={saveScheduleEdit}>수정 저장</PrimaryButton>
              <button className="w-full rounded-2xl bg-muted/70 px-4 py-3 text-sm font-bold" onClick={() => setEditingScheduleId(null)}>닫기</button>
            </div>
          )}
          {!showCreate ? (
            <PrimaryButton onClick={() => setShowCreate(true)} icon={<Plus size={17} />}>일정 생성</PrimaryButton>
          ) : (
            <div className="space-y-3 border-t border-white/70 pt-4 dark:border-white/10">
              <Field label="개인 일정 제목" value={personalTitle} onChange={setPersonalTitle} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="시작" type="time" value={personalStart} onChange={setPersonalStart} />
                <Field label="종료" type="time" value={personalEnd} onChange={setPersonalEnd} />
              </div>
              <PrimaryButton onClick={addPersonalSchedule}>개인 일정 추가</PrimaryButton>
              <button className="w-full rounded-2xl bg-muted/70 px-4 py-3 text-sm font-bold" onClick={() => setShowCreate(false)}>닫기</button>
            </div>
          )}
        </Panel>
        <Panel title="다가오는 일정"><div className="space-y-3">{upcoming.map((schedule) => <ScheduleRow key={schedule.id} schedule={schedule} data={data} currentUser={currentUser} />)}</div></Panel>
        <Panel title="고정 공지"><div className="space-y-3">{pinned.map((notice) => <NoticeCard key={notice.id} notice={notice} />)}</div></Panel>
      </aside>
    </div>
  );
}
