import { formatDateTime } from "@/lib/format";
import { alpha, eventColor, teamColor } from "@/lib/schedule";
import type { AppData, ClubUser, Notice, Schedule } from "@/types/domain";

export function CalendarEventPill({ schedule, data, currentUser }: { schedule: Schedule; data: AppData; currentUser: ClubUser }) {
  const color = eventColor(schedule, data, currentUser);
  return <div className="truncate rounded-md px-2 py-1 text-[11px] font-black text-foreground shadow-sm" style={{ backgroundColor: `${color}55` }}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{schedule.title}</div>;
}

export function ScheduleRow({ schedule, data, currentUser, editable = false, onEdit, onCancel }: { schedule: Schedule; data: AppData; currentUser: ClubUser; editable?: boolean; onEdit?: () => void; onCancel?: () => void }) {
  const color = eventColor(schedule, data, currentUser);
  return (
    <div className="flex gap-3 rounded-[1.1rem] bg-muted/55 p-3">
      <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-black">{schedule.title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{formatDateTime(schedule.startsAt)} - {formatDateTime(schedule.endsAt)}</p>
        {editable && (
          <div className="mt-2 flex gap-2">
            <button type="button" className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-black" onClick={onEdit}>수정</button>
            <button type="button" className="rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-black text-destructive" onClick={onCancel}>취소</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function NoticeCard({ notice }: { notice: Notice }) {
  return <div className="rounded-[1.1rem] bg-muted/70 p-4"><p className="font-black">{notice.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{notice.content}</p></div>;
}

export function UserPill({ user, data }: { user: ClubUser; data: AppData }) {
  const team = data.teams.find((item) => item.id === user.teamId);
  const color = teamColor(team);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-black" style={{ backgroundColor: alpha(color, "42"), color: "#1f2937" }}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {user.name}
    </span>
  );
}
