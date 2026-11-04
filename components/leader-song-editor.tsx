import { useState } from "react";
import { formatSongDuration, nowIso, parseSongDuration } from "@/lib/format";
import { activeLeaderSongs, inkOn, songColor } from "@/lib/schedule";
import { uid } from "@/lib/utils";
import type { AppData, ClubUser, Song, SongMember } from "@/types/domain";
import { UserPill } from "@/components/items";
import { Field, Panel, PrimaryButton, Select, SoftCheckbox } from "@/components/ui";

type PanelProps = { data: AppData; currentUser: ClubUser; persist: (data: AppData) => void };

// 곡팀장이 자기 곡의 이름, 시간, 소속 팀, 팀원을 고친다. 곡팀장 변경과 곡 삭제는 관리자만 한다.
export function LeaderSongEditor({ data, currentUser, persist }: PanelProps) {
  const songs = activeLeaderSongs(currentUser.id, data);
  const [editingId, setEditingId] = useState("");
  return (
    <Panel title="내 곡">
      <div className="grid gap-3">
        {songs.map((song) => editingId === song.id
          ? <SongForm key={song.id} song={song} data={data} currentUser={currentUser} persist={persist} close={() => setEditingId("")} />
          : <SongCard key={song.id} song={song} data={data} currentUser={currentUser} onEdit={() => setEditingId(song.id)} />)}
      </div>
    </Panel>
  );
}

function SongCard({ song, data, currentUser, onEdit }: { song: Song; data: AppData; currentUser: ClubUser; onEdit: () => void }) {
  const color = songColor(song, data, currentUser);
  const performance = data.performances.find((item) => item.id === song.performanceId);
  const team = data.teams.find((item) => item.id === song.teamId);
  const members = data.songMembers.filter((member) => member.songId === song.id).map((member) => data.users.find((user) => user.id === member.userId)).filter(Boolean) as ClubUser[];
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: color, color: inkOn(color) }}>
      <p className="text-lg font-semibold">{song.title}</p>
      <p className="text-sm opacity-70">
        {performance?.title} · {team?.name ?? "팀 없음"}{song.durationSeconds ? ` · ${formatSongDuration(song.durationSeconds)}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {members.map((user) => <UserPill key={user.id} user={user} data={data} viewer={currentUser} />)}
      </div>
      <button type="button" className="mt-3 rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white" onClick={onEdit}>팀 수정</button>
    </div>
  );
}

function SongForm({ song, data, currentUser, persist, close }: PanelProps & { song: Song; close: () => void }) {
  const performance = data.performances.find((item) => item.id === song.performanceId);
  const candidates = data.users.filter((user) => (performance?.memberIds ?? []).includes(user.id));
  const [form, setForm] = useState(() => ({
    title: song.title,
    duration: formatSongDuration(song.durationSeconds),
    teamId: song.teamId,
    memberIds: data.songMembers.filter((member) => member.songId === song.id).map((member) => member.userId),
  }));
  const color = songColor(song, data, currentUser);

  function save() {
    if (!form.title.trim()) return;
    const updatedAt = nowIso();
    // 곡팀장은 항상 팀원으로 남긴다.
    const memberIds = form.memberIds.includes(song.leaderUserId) ? form.memberIds : [...form.memberIds, song.leaderUserId];
    const nextMemberships: SongMember[] = memberIds.map((userId) => ({ id: uid("member"), performanceId: song.performanceId, songId: song.id, userId, joinedAt: updatedAt }));
    persist({
      ...data,
      songs: data.songs.map((item) => item.id === song.id ? { ...item, title: form.title.trim(), durationSeconds: parseSongDuration(form.duration), teamId: form.teamId, updatedAt } : item),
      songMembers: [...data.songMembers.filter((member) => member.songId !== song.id), ...nextMemberships],
    });
    close();
  }

  return (
    <div className="space-y-3 rounded-2xl p-4" style={{ backgroundColor: color, color: inkOn(color) }}>
      <Field label="곡 / 무대 이름" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
      <Field label="곡 시간 (선택, 분:초)" value={form.duration} onChange={(value) => setForm({ ...form, duration: value })} placeholder="예: 3:30" />
      <Select label="소속 팀" value={form.teamId} onChange={(value) => setForm({ ...form, teamId: value })} options={data.teams.map((item) => [item.id, item.name])} />
      <div className="rounded-xl bg-background p-3 text-foreground">
        <p className="mb-2 text-sm font-semibold">팀원</p>
        <div className="grid max-h-56 gap-2 overflow-auto">
          {candidates.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-2 rounded-xl p-2 text-sm">
              <UserPill user={user} data={data} viewer={currentUser} />
              {user.id === song.leaderUserId
                ? <span className="px-2.5 text-xs font-semibold text-muted-foreground">곡팀장</span>
                : <SoftCheckbox checked={form.memberIds.includes(user.id)} label="참여" onToggle={() => setForm((prev) => ({ ...prev, memberIds: prev.memberIds.includes(user.id) ? prev.memberIds.filter((id) => id !== user.id) : [...prev.memberIds, user.id] }))} />}
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <PrimaryButton onClick={save} disabled={!form.title.trim()}>수정 저장</PrimaryButton>
        <button type="button" className="rounded-xl bg-background px-4 py-3 text-sm font-semibold text-foreground" onClick={close}>취소</button>
      </div>
    </div>
  );
}
