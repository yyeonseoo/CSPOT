import { useRef, useState } from "react";
import { nowIso, today } from "@/lib/format";
import { defaultBlue, isAppData } from "@/lib/schedule";
import type { AppData, ClubUser } from "@/types/domain";
import { ColorField, Field, Panel, PrimaryButton } from "@/components/ui";

export function MyPagePanel({ data, currentUser, persist }: { data: AppData; currentUser: ClubUser; persist: (data: AppData) => void }) {
  const [form, setForm] = useState({ username: currentUser.username, password: currentUser.password });
  const [performanceColors, setPerformanceColors] = useState<Record<string, string>>(currentUser.performanceColors ?? {});
  const [backupMessage, setBackupMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function save() {
    persist({ ...data, users: data.users.map((user) => user.id === currentUser.id ? { ...user, ...form, performanceColors, updatedAt: nowIso() } : user) });
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
        const normalizedData: AppData = { ...nextData, archiveSongs: nextData.archiveSongs ?? [] };
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
        <Field label="아이디" value={form.username} onChange={(value) => setForm({ ...form, username: value })} />
        <Field label="비밀번호" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
        <div className="space-y-3 rounded-2xl bg-muted/50 p-4">
          <div>
            <p className="text-sm font-black">공연 색상</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">캘린더와 곡 카드에 표시할 공연별 색상입니다.</p>
          </div>
          {data.performances.length === 0 ? (
            <p className="rounded-2xl bg-white/50 p-4 text-sm font-bold text-muted-foreground">아직 생성된 공연이 없습니다.</p>
          ) : (
            data.performances.map((performance) => (
              <ColorField key={performance.id} label={performance.title} value={performanceColors[performance.id] ?? defaultBlue} onChange={(value) => setPerformanceColors({ ...performanceColors, [performance.id]: value })} />
            ))
          )}
        </div>
        <PrimaryButton onClick={save}>저장</PrimaryButton>
        <div className="space-y-3 rounded-2xl bg-muted/50 p-4">
          <div>
            <p className="text-sm font-black">로컬 데이터 백업</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">멤버, 공연, 곡, 일정, 공지 데이터를 JSON 파일로 저장하고 복구합니다.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20" onClick={exportBackup}>백업 내보내기</button>
            <button type="button" className="rounded-2xl bg-white/75 px-4 py-3 text-sm font-black shadow-sm" onClick={() => fileInputRef.current?.click()}>백업 가져오기</button>
          </div>
          <input ref={fileInputRef} className="hidden" type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0] ?? null)} />
          {backupMessage && <p className="text-xs font-bold text-muted-foreground">{backupMessage}</p>}
        </div>
      </div>
    </Panel>
  );
}
