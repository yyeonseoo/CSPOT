import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { formatSongDuration } from "@/lib/format";
import { songColor } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { AppData, ClubUser, Song } from "@/types/domain";

// 셋리스트 순서 바꾸기: 옮길 곡을 누르고, 들어갈 자리의 곡을 누르면 그 자리로 옮긴다. 옮길 때마다 바로 저장한다.
export function SetlistOrder({ songs, data, currentUser, onSave, onClose }: { songs: Song[]; data: AppData; currentUser: ClubUser; onSave: (ids: string[]) => void; onClose: () => void }) {
  const [selectedId, setSelectedId] = useState("");
  const ids = songs.map((song) => song.id);

  function moveTo(songId: string, index: number) {
    if (index < 0 || index >= ids.length) return;
    const rest = ids.filter((id) => id !== songId);
    rest.splice(index, 0, songId);
    onSave(rest);
  }

  function tap(songId: string) {
    if (!selectedId || selectedId === songId) return setSelectedId(selectedId === songId ? "" : songId);
    moveTo(selectedId, ids.indexOf(songId));
    setSelectedId("");
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        {songs.map((song, index) => {
          const selected = song.id === selectedId;
          return (
            <div key={song.id} className={cn("flex items-center gap-2 rounded-xl text-sm transition", selected ? "bg-foreground text-background" : selectedId ? "bg-muted ring-1 ring-inset ring-primary/40" : "bg-muted")}>
              <button type="button" aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left" onClick={() => tap(song.id)}>
                <span className="w-6 shrink-0 text-right text-xs font-bold tabular-nums opacity-70">{index + 1}</span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: songColor(song, data, currentUser) }} />
                <span className="min-w-0 flex-1 truncate font-semibold">{song.title}</span>
                <span className="shrink-0 text-xs tabular-nums opacity-70">{formatSongDuration(song.durationSeconds)}</span>
              </button>
              {selected && (
                <span className="flex shrink-0 gap-1 pr-2">
                  <button type="button" aria-label="한 칸 위로" disabled={index === 0} className="grid h-8 w-8 place-items-center rounded-lg bg-background text-foreground disabled:opacity-30" onClick={() => moveTo(song.id, index - 1)}><ArrowUp size={16} /></button>
                  <button type="button" aria-label="한 칸 아래로" disabled={index === songs.length - 1} className="grid h-8 w-8 place-items-center rounded-lg bg-background text-foreground disabled:opacity-30" onClick={() => moveTo(song.id, index + 1)}><ArrowDown size={16} /></button>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" className="w-full rounded-xl bg-muted px-4 py-3 text-sm font-semibold" onClick={onClose}>완료</button>
    </div>
  );
}
