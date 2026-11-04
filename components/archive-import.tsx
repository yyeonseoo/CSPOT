import { useState } from "react";
import { formatSongDuration, nowIso } from "@/lib/format";
import { archiveSourceLabel } from "@/lib/schedule";
import { uid } from "@/lib/utils";
import type { AppData, ArchiveSong, ClubUser, Performance, Song, SongMember } from "@/types/domain";
import { Panel } from "@/components/ui";

// 과거 공연 이력 카드를 이 공연의 곡 팀으로 가져온다. 이름이 같은 멤버를 팀원으로 넣고, 공연 참여 인원에 없으면 같이 넣는다.
export function ArchiveImport({ performance, data, persist, onDone }: { performance: Performance; data: AppData; persist: (data: AppData) => void; onDone: () => void }) {
  const [keyword, setKeyword] = useState("");
  const search = keyword.trim().toLowerCase();
  const items = search ? data.archiveSongs.filter((item) => !item.archiveKey.startsWith(`current-${performance.id}-`) && `${item.songTitle} ${item.performanceTitle} ${item.memberNames.join(" ")}`.toLowerCase().includes(search)) : [];
  const usersOf = (item: ArchiveSong) => item.memberNames
    .map((name) => data.users.find((user) => user.name === name.trim()))
    .filter((user, index, list): user is ClubUser => Boolean(user) && list.indexOf(user) === index);

  function importSong(item: ArchiveSong) {
    const members = usersOf(item);
    if (members.length === 0) return;
    const createdAt = nowIso();
    const leader = members.find((user) => user.name === item.leaderName.trim()) ?? members[0];
    const song: Song = { id: uid("song"), performanceId: performance.id, teamId: item.teamId, title: item.songTitle, durationSeconds: item.durationSeconds, leaderUserId: leader.id, requiredPracticeCount: 0, estimatedPracticeMinutes: 120, order: data.songs.length + 1, status: "ACTIVE", createdAt, updatedAt: createdAt };
    const memberships: SongMember[] = members.map((user) => ({ id: uid("member"), performanceId: performance.id, songId: song.id, userId: user.id, joinedAt: createdAt }));
    const memberIds = Array.from(new Set([...(performance.memberIds ?? []), ...members.map((user) => user.id)]));
    persist({
      ...data,
      performances: data.performances.map((other) => other.id === performance.id ? { ...other, memberIds, updatedAt: createdAt } : other),
      songs: [...data.songs, song],
      songMembers: [...data.songMembers, ...memberships],
    });
    onDone();
  }

  return (
    <Panel title="이전 곡 불러오기" className="bg-background p-3 sm:p-6">
      <div className="space-y-3">
        <input
          className="w-full rounded-xl bg-muted px-4 py-3 text-sm font-medium outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/30"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="곡명, 공연명, 이름으로 검색"
        />
        <div className="grid max-h-80 gap-2 overflow-auto">
          {search && items.length === 0 && <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>}
          {items.map((item) => {
            const found = usersOf(item).length;
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.songTitle}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {archiveSourceLabel(item)} {item.performanceTitle}, {item.memberNames.length}명{item.durationSeconds ? `, ${formatSongDuration(item.durationSeconds)}` : ""}
                    {found < item.memberNames.length && ` (멤버 목록에 없는 ${item.memberNames.length - found}명 제외)`}
                  </p>
                </div>
                <button type="button" disabled={found === 0} className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-35" onClick={() => importSong(item)}>불러오기</button>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
