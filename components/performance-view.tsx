import { useState } from "react";
import { formatDateTime, formatSongDuration } from "@/lib/format";
import { isPastPerformance, teamColor, performanceColor, inkOn } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { AppData, Performance, ClubUser } from "@/types/domain";
import { UserPill } from "@/components/items";
import { Panel, Tabs } from "@/components/ui";

// 일반 사용자용 공연 보기. 수정 기능 없이 공연 정보, 곡 팀, 참여 인원만 보여준다.
export function PerformanceView({ data, currentUser }: { data: AppData; currentUser: ClubUser }) {
  const upcoming = data.performances.filter((performance) => !isPastPerformance(performance)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = data.performances.filter((performance) => isPastPerformance(performance)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const [selectedId, setSelectedId] = useState(upcoming[0]?.id ?? "");
  const selected = data.performances.find((performance) => performance.id === selectedId);

  const card = (performance: Performance) => (
    <button
      key={performance.id}
      type="button"
      style={{ backgroundColor: performanceColor(performance, currentUser), color: inkOn(performanceColor(performance, currentUser)) }}
      className={cn("rounded-2xl p-4 text-left", selectedId === performance.id && "ring-2 ring-foreground ring-offset-2 ring-offset-card")}
      onClick={() => setSelectedId(selectedId === performance.id ? "" : performance.id)}
    >
      <p className="font-semibold">{performance.title}</p>
      <p className="mt-1 text-sm opacity-70">{formatDateTime(performance.startsAt)} · {performance.location || "장소 미정"}</p>
    </button>
  );

  return (
    <section className="space-y-4">
      <Panel title="공연">
        {upcoming.length === 0 && <p className="text-sm text-muted-foreground">예정된 공연이 없습니다.</p>}
        <div className="grid gap-3 md:grid-cols-2">{upcoming.map(card)}</div>
        {past.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">지난 공연 {past.length}개</summary>
            <div className="mt-3 grid gap-3 opacity-70 md:grid-cols-2">{past.map(card)}</div>
          </details>
        )}
      </Panel>
      {selected && <PerformanceInfo key={selected.id} data={data} performance={selected} />}
    </section>
  );
}

function PerformanceInfo({ data, performance }: { data: AppData; performance: Performance }) {
  const [tab, setTab] = useState<"songs" | "members">("songs");
  const [focusId, setFocusId] = useState("");
  const songs = data.songs.filter((song) => song.performanceId === performance.id).sort((a, b) => a.order - b.order);
  const members = data.users.filter((user) => performance.memberIds.includes(user.id));
  const membersOf = (songId: string) => data.songMembers.filter((member) => member.songId === songId).map((member) => data.users.find((user) => user.id === member.userId)).filter((user) => user !== undefined);
  const focus = members.find((user) => user.id === focusId);
  const focusSongs = songs.filter((song) => data.songMembers.some((member) => member.songId === song.id && member.userId === focusId));

  return (
    <Panel title={`${performance.title}${isPastPerformance(performance) ? " (지난 공연)" : ""}`}>
      <div className="mb-3 rounded-2xl bg-background p-4 text-sm">
        <p className="font-semibold">{formatDateTime(performance.startsAt)} ~ {formatDateTime(performance.endsAt)}</p>
        <p className="text-muted-foreground">{performance.location || "장소 미정"}</p>
        {performance.description && <p className="mt-2 whitespace-pre-wrap leading-6 text-muted-foreground">{performance.description}</p>}
      </div>
      <Tabs className="mb-3" tabs={[["songs", `곡 팀 ${songs.length}`], ["members", `참여 인원 ${members.length}`]]} value={tab} onChange={setTab} />
      {tab === "songs" && (
        <div className="grid gap-3">
          {songs.length === 0 && <p className="text-sm text-muted-foreground">아직 곡 팀이 없습니다.</p>}
          {songs.map((song, index) => {
            const team = data.teams.find((item) => item.id === song.teamId);
            return (
              <div key={song.id} className="rounded-2xl p-4 text-neutral-900" style={{ backgroundColor: teamColor(team) }}>
                <p className="font-semibold">{index + 1}. {song.title}</p>
                <p className="text-sm text-neutral-700">
                  {team?.name ?? "팀 없음"} · 곡팀장 {data.users.find((user) => user.id === song.leaderUserId)?.name ?? "미지정"}
                  {song.durationSeconds ? ` · ${formatSongDuration(song.durationSeconds)}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {membersOf(song.id).map((user) => <UserPill key={user.id} user={user} data={data} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === "members" && (
        <div className="space-y-3">
          {members.length === 0 && <p className="text-sm text-muted-foreground">아직 참여 인원이 없습니다.</p>}
          <div className="flex flex-wrap gap-2">
            {members.map((user) => (
              <button key={user.id} type="button" className={cn("rounded-full", focusId === user.id && "ring-2 ring-foreground")} onClick={() => setFocusId(focusId === user.id ? "" : user.id)}>
                <UserPill user={user} data={data} />
              </button>
            ))}
          </div>
          {focus && (
            <div className="rounded-2xl bg-background p-3 text-sm">
              <p className="mb-2 font-semibold">{focus.name} 참여 곡</p>
              {focusSongs.length === 0 ? (
                <p className="text-muted-foreground">이 공연에서 참여하는 곡이 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {focusSongs.map((song) => (
                    <span key={song.id} className="rounded-full px-3 py-1.5 text-sm font-medium" style={{ backgroundColor: teamColor(data.teams.find((team) => team.id === song.teamId)), color: inkOn(teamColor(data.teams.find((team) => team.id === song.teamId))) }}>
                      {song.title}{song.leaderUserId === focus.id && " (곡팀장)"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
