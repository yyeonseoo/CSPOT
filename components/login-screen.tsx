import { Moon, RotateCcw, Sun } from "lucide-react";
import { useState } from "react";
import type { Portal } from "@/lib/session";
import { Field, segmentClass } from "@/components/ui";

export function LoginScreen({
  mode,
  setMode,
  onLogin,
  onReset,
  dark,
  toggleTheme,
}: {
  mode: Portal;
  setMode: (mode: Portal) => void;
  onLogin: (name: string) => string | null;
  onReset: () => void;
  dark: boolean;
  toggleTheme: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: Portal) {
    setMode(next);
    setError(null);
  }

  return (
    <main className="soft-shell flex min-h-screen flex-col px-4 py-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Club Scheduler</p>
        <button className="grid h-10 w-10 place-items-center rounded-full bg-card" onClick={toggleTheme} aria-label="테마 변경">
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <h1 className="mb-6 text-4xl font-bold tracking-tight">동아리 일정</h1>
        <form
          className="rounded-3xl bg-card p-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError(onLogin(name));
          }}
        >
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-background p-1">
            <button type="button" className={segmentClass(mode === "user")} onClick={() => switchMode("user")}>사용자</button>
            <button type="button" className={segmentClass(mode === "admin")} onClick={() => switchMode("admin")}>관리자</button>
          </div>
          <div className="space-y-4">
            <Field label="이름" value={name} placeholder="예: 홍길동" onChange={setName} />
            {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <button className="w-full rounded-full bg-primary px-5 py-3.5 text-base font-semibold text-primary-foreground">로그인</button>
          </div>
        </form>
        <button type="button" className="mt-4 inline-flex items-center gap-1.5 self-center text-xs font-medium text-muted-foreground" onClick={onReset}>
          <RotateCcw size={13} />
          로컬 데이터 초기화
        </button>
      </div>
    </main>
  );
}
