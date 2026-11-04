import { useState } from "react";
import { formatSongDuration } from "@/lib/format";
import { songColor } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { AppData, ClubUser, Song } from "@/types/domain";
import { PrimaryButton } from "@/components/ui";

// 셋리스트 순서 정하기: 누른 순서대로 1번부터 번호가 붙는다. 다시 누르면 빠지고 뒤 번호가 당겨진다.
// 저장하면 누른 곡이 앞에, 안 누른 곡은 원래 순서대로 뒤에 온다.
export function SetlistOrder({ songs, data, currentUser, onSave, onClose }: { songs: Song[]; data: AppData; currentUser: ClubUser; onSave: (ids: string[]) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{picked.length}/{songs.length}곡</p>
        <button type="button" className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold" onClick={() => setPicked([])}>처음부터</button>
      </div>
      <div className="grid gap-1.5">
        {songs.map((song) => {
          const position = picked.indexOf(song.id) + 1;
          return (
            <button
              key={song.id}
              type="button"
              aria-pressed={position > 0}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition", position ? "bg-foreground text-background" : "bg-muted")}
              onClick={() => toggle(song.id)}
            >
              <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums", position ? "bg-background text-foreground" : "bg-background/60 text-transparent")}>{position || 0}</span>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: songColor(song, data, currentUser) }} />
              <span className="min-w-0 flex-1 truncate font-semibold">{song.title}</span>
              <span className="shrink-0 text-xs tabular-nums opacity-70">{formatSongDuration(song.durationSeconds)}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="rounded-xl bg-muted px-4 py-3 text-sm font-semibold" onClick={onClose}>취소</button>
        <PrimaryButton
          disabled={picked.length === 0}
          onClick={() => { onSave([...picked, ...songs.map((song) => song.id).filter((id) => !picked.includes(id))]); onClose(); }}
        >
          순서 저장
        </PrimaryButton>
      </div>
    </div>
  );
}
