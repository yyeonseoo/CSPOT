import { formatDateTime, toDatetimeLocal } from "@/lib/format";
import { eventColor, inkOn, teamColor } from "@/lib/schedule";
import type { AppData, ClubUser, Notice, Schedule } from "@/types/domain";

export function CalendarEventPill({ schedule, data, currentUser }: { schedule: Schedule; data: AppData; currentUser: ClubUser }) {
  const color = eventColor(schedule, data, currentUser);
  return <div className="truncate rounded-md px-2 py-1 text-[11px] font-semibold" style={{ backgroundColor: color, color: inkOn(color) }}>{schedule.title}</div>;
}

function formatScheduleRange(startsAt: string, endsAt: string) {
  const sameDay = toDatetimeLocal(startsAt).slice(0, 10) === toDatetimeLocal(endsAt).slice(0, 10);
  return sameDay ? `${formatDateTime(startsAt)}~${toDatetimeLocal(endsAt).slice(11)}` : `${formatDateTime(startsAt)} ~ ${formatDateTime(endsAt)}`;
}

export function ScheduleRow({ schedule, data, currentUser, editable = false, onEdit, onCancel }: { schedule: Schedule; data: AppData; currentUser: ClubUser; editable?: boolean; onEdit?: () => void; onCancel?: () => void }) {
  const color = eventColor(schedule, data, currentUser);
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: color, color: inkOn(color) }}>
      <div className="min-w-0">
        <p className="truncate font-semibold">{schedule.title}</p>
        <p className="text-xs leading-5 opacity-70">{formatScheduleRange(schedule.startsAt, schedule.endsAt)}{schedule.location && `, ${schedule.location}`}</p>
        {editable && (
          <div className="mt-2 flex gap-2">
            <button type="button" className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold" onClick={onEdit}>수정</button>
            <button type="button" className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white" onClick={onCancel}>취소</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function NoticeCard({ notice }: { notice: Notice }) {
  return <div className="rounded-2xl bg-[#FFF200] p-4 text-neutral-900"><p className="font-semibold">{notice.title}</p><p className="mt-1 text-sm leading-6 text-neutral-700">{notice.content}</p></div>;
}

export function UserPill({ user, data }: { user: ClubUser; data: AppData }) {
  const team = data.teams.find((item) => item.id === user.teamId);
  const color = teamColor(team);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/85 px-3 py-1.5 text-sm font-medium text-neutral-900">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {user.name}
    </span>
  );
}
