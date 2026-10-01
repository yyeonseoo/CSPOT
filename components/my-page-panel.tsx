import { useRef, useState } from "react";
import { nowIso, today } from "@/lib/format";
import { normalizeData } from "@/lib/local-data";
import { defaultAccent, isAppData, isPastPerformance } from "@/lib/schedule";
import { applyPattern, LEOPARDS, patternBackground, readPattern } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { AppData, ClubUser } from "@/types/domain";
import { ColorField, Panel, PrimaryButton } from "@/components/ui";

export function MyPagePanel({ data, currentUser, adminMode, persist }: { data: AppData; currentUser: ClubUser; adminMode: boolean; persist: (data: AppData) => void }) {
  const [performanceColors, setPerformanceColors] = useState<Record<string, string>>(currentUser.performanceColors ?? {});
  const upcomingPerformances = data.performances.filter((performance) => !isPastPerformance(performance));
  const [pattern, setPattern] = useState(() => readPattern());
  const choosePattern = (id: string) => { applyPattern(id); setPattern(id); };
  const [backupMessage, setBackupMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function save() {
    persist({ ...data, users: data.users.map((user) => user.id === currentUser.id ? { ...user, performanceColors, updatedAt: nowIso() } : user) });
  }

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
        setPerformanceColors(normalizedData.users.find((user) => user.id === currentUser.id)?.performanceColors ?? {});
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
          <p className="text-sm font-semibold">배경 테마 <span className="font-normal text-muted-foreground">(이 기기에만 적용)</span></p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            <button type="button" onClick={() => choosePattern("")} className={cn("flex aspect-square flex-col items-center justify-end rounded-xl bg-background p-1.5 text-[11px] font-medium", pattern === "" && "ring-2 ring-foreground ring-offset-2 ring-offset-muted")}>기본</button>
            {LEOPARDS.map((item) => (
              <button key={item.id} type="button" onClick={() => choosePattern(item.id)} style={{ background: patternBackground(item.id).replace("220px", "110px") }} className={cn("flex aspect-square flex-col items-center justify-end rounded-xl p-1.5", pattern === item.id && "ring-2 ring-foreground ring-offset-2 ring-offset-muted")}>
                <span className="whitespace-nowrap rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-neutral-900">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-xl bg-muted p-4">
          <p className="text-sm font-semibold">공연 색상</p>
          {upcomingPerformances.length === 0 ? (
            <p className="rounded-xl bg-background p-4 text-sm font-medium text-muted-foreground">예정된 공연이 없습니다.</p>
          ) : (
            upcomingPerformances.map((performance) => (
              <ColorField key={performance.id} label={performance.title} value={performanceColors[performance.id] ?? defaultAccent} onChange={(value) => setPerformanceColors({ ...performanceColors, [performance.id]: value })} />
            ))
          )}
        </div>
        <PrimaryButton onClick={save}>저장</PrimaryButton>
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
