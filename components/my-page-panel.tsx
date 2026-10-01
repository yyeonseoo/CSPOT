import { useRef, useState } from "react";
import { nowIso, today } from "@/lib/format";
import { normalizeData } from "@/lib/local-data";
import { isAppData, isPastPerformance, performanceColor, songColor, teamColor } from "@/lib/schedule";
import { applyTheme, readTheme, THEMES } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { AppData, ClubUser } from "@/types/domain";
import { ColorDots, Field, Panel, PrimaryButton, Select } from "@/components/ui";

export function MyPagePanel({ data, currentUser, adminMode, persist }: { data: AppData; currentUser: ClubUser; adminMode: boolean; persist: (data: AppData) => void }) {
  // 예정 공연 먼저, 그다음 지난 공연(최근 순)
  const performances = [
    ...data.performances.filter((performance) => !isPastPerformance(performance)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    ...data.performances.filter((performance) => isPastPerformance(performance)).sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
  ];
  const [performanceId, setPerformanceId] = useState(performances[0]?.id ?? "");
  const pickedPerformance = performances.find((performance) => performance.id === performanceId);
  const [theme, setTheme] = useState(() => readTheme());
  const chooseTheme = (id: string) => { applyTheme(id); setTheme(id); };
  const [loginId, setLoginId] = useState(currentUser.username);
  const [idMessage, setIdMessage] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function saveLoginId() {
    const next = loginId.trim();
    if (!next || next === currentUser.username) return;
    if (data.users.some((user) => user.id !== currentUser.id && (user.username === next || user.name === next))) {
      setIdMessage("이미 있는 아이디입니다.");
      return;
    }
    persist({ ...data, users: data.users.map((user) => user.id === currentUser.id ? { ...user, username: next, updatedAt: nowIso() } : user) });
    setIdMessage("바꿨습니다. 다음 로그인부터 새 아이디로 들어오세요.");
  }

  // 이 페이지의 색은 모두 나에게만 보이는 색. 고르면 바로 저장.
  type ColorMap = "performanceColors" | "teamColors" | "songColors";
  function setMyColor(key: ColorMap, id: string, color: string) {
    persist({ ...data, users: data.users.map((user) => user.id === currentUser.id ? { ...user, [key]: { ...user[key], [id]: color }, updatedAt: nowIso() } : user) });
  }
  // 고른 공연에서 내가 팀장이거나 팀원인 곡
  const mySongs = data.songs.filter((song) => song.performanceId === performanceId && (song.leaderUserId === currentUser.id || data.songMembers.some((member) => member.songId === song.id && member.userId === currentUser.id)));

  function exportBackup() {
    const payload = {
      app: "club-scheduler",
      version: 1,
      exportedAt: nowIso(),
      data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `club-scheduler-backup-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupMessage("백업 파일을 내려받았습니다.");
  }

  function importBackup(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const nextData: AppData | null = isAppData(parsed) ? parsed : isAppData(parsed?.data) ? parsed.data : null;
        if (!nextData) {
          setBackupMessage("앱 백업 파일 형식이 아닙니다.");
          return;
        }
        const ok = window.confirm("현재 로컬 데이터를 백업 파일 내용으로 교체할까요?");
        if (!ok) {
          setBackupMessage("가져오기를 취소했습니다.");
          return;
        }
        const normalizedData = normalizeData({ ...nextData, archiveSongs: nextData.archiveSongs ?? [] });
        persist(normalizedData);
        setBackupMessage("백업 파일을 가져왔습니다.");
      } catch {
        setBackupMessage("백업 파일을 읽지 못했습니다.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  return (
    <Panel title="마이페이지" className="max-w-2xl">
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl bg-muted p-4">
          <Field label="아이디" value={loginId} onChange={(value) => { setLoginId(value); setIdMessage(""); }} />
          <PrimaryButton onClick={saveLoginId} disabled={!loginId.trim() || loginId.trim() === currentUser.username}>아이디 바꾸기</PrimaryButton>
          {idMessage && <p className="text-sm font-medium">{idMessage}</p>}
        </div>
        <div className="space-y-3 rounded-xl bg-muted p-4">
          <p className="text-sm font-semibold">화면 색</p>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map((item) => (
              <button key={item.id} type="button" onClick={() => chooseTheme(item.id)} className={cn("space-y-1.5 rounded-xl p-1.5 text-[11px] font-medium", theme === item.id && "ring-2 ring-foreground")}>
                {/* 바탕 위에 흰 카드와 포인트 색을 올린 작은 미리보기 */}
                <span className="flex aspect-square flex-col justify-end gap-1 rounded-lg p-1.5" style={{ background: item.dark ? "#000" : `hsl(${item.page})` }}>
                  <span className="h-3 rounded" style={{ background: item.dark ? "#141414" : "#fff" }} />
                  <span className="h-3 rounded-full" style={{ background: item.accent ? `hsl(${item.accent})` : item.dark ? "#fff" : "#111" }} />
                </span>
                <span className="block whitespace-nowrap">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-xl bg-muted p-4">
          <p className="text-sm font-semibold">공연 색</p>
          {pickedPerformance ? (
            <>
              <Select label="" value={performanceId} onChange={setPerformanceId} options={performances.map((performance) => [performance.id, isPastPerformance(performance) ? `${performance.title} (지난 공연)` : performance.title])} />
              <ColorDots value={performanceColor(pickedPerformance, currentUser)} onChange={(color) => setMyColor("performanceColors", performanceId, color)} />
              {mySongs.map((song) => (
                <div key={song.id} className="space-y-2 pt-1">
                  <p className="text-sm font-medium">{song.title}</p>
                  <ColorDots small value={songColor(song, data, currentUser)} onChange={(color) => setMyColor("songColors", song.id, color)} />
                </div>
              ))}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">공연이 없습니다.</p>
          )}
        </div>
        <div className="space-y-3 rounded-xl bg-muted p-4">
          <p className="text-sm font-semibold">팀 색</p>
          {data.teams.filter((item) => item.isActive).map((item) => (
            <div key={item.id} className="space-y-2">
              <p className="text-sm font-medium">{item.name}</p>
              <ColorDots small value={teamColor(item, currentUser)} onChange={(color) => setMyColor("teamColors", item.id, color)} />
            </div>
          ))}
        </div>
        {adminMode && <div className="space-y-3 rounded-xl bg-muted p-4">
          <p className="text-sm font-semibold">데이터 백업</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" onClick={exportBackup}>백업 내보내기</button>
            <button type="button" className="rounded-xl bg-background px-4 py-3 text-sm font-semibold shadow-sm" onClick={() => fileInputRef.current?.click()}>백업 가져오기</button>
          </div>
          <input ref={fileInputRef} className="hidden" type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0] ?? null)} />
          {backupMessage && <p className="text-xs font-medium text-muted-foreground">{backupMessage}</p>}
        </div>}
      </div>
    </Panel>
  );
}
