"use client";

import { useEffect, useRef, useState } from "react";
import { createInitialData, normalizeData, readData, SESSION_KEY, syncCurrentSongsToArchive, writeData } from "@/lib/local-data";
import { isAdminRole } from "@/lib/permissions";
import { CLUB_CODE_KEY, diffData, loadRemote, saveRemote } from "@/lib/remote-data";
import { readSession, writeSession, type Portal, type Session } from "@/lib/session";
import { applyTheme, readTheme } from "@/lib/theme";
import type { AppData } from "@/types/domain";
import { AppShell } from "@/components/app-shell";
import { ClubCodeScreen, LoginScreen } from "@/components/login-screen";

// remote: 서버 DB 사용, local: DB 설정이 없어서 브라우저 저장소 사용(개발용), code: 동아리 코드 입력 대기
type Mode = "loading" | "code" | "remote" | "local" | "error";
const REFRESH_MS = 60_000;

export default function HomePage() {
  const [data, setData] = useState<AppData | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [codeError, setCodeError] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loginMode, setLoginMode] = useState<Portal>("user");
  const codeRef = useRef("");
  // 서버에 저장된 것으로 알고 있는 마지막 상태. 저장할 때 이것과 비교해 바뀐 항목만 보낸다.
  const serverRef = useRef<AppData | null>(null);
  const pendingSaves = useRef(0);

  function save(next: AppData) {
    const prev = serverRef.current;
    if (!prev) return;
    serverRef.current = next;
    const diff = diffData(prev, next);
    if (diff.upserts.length === 0 && diff.deletes.length === 0) return;
    pendingSaves.current += 1;
    saveRemote(codeRef.current, diff)
      .catch(() => setSaveFailed(true))
      .finally(() => { pendingSaves.current -= 1; });
  }

  async function connect(code: string) {
    setMode("loading");
    const result = await loadRemote(code).catch(() => "error" as const);
    if (result === "local") {
      setData(readData());
      setMode("local");
      return;
    }
    if (result === "unauthorized") {
      window.localStorage.removeItem(CLUB_CODE_KEY);
      setCodeError(code ? "코드가 맞지 않습니다." : "");
      setMode("code");
      return;
    }
    if (result === "error") {
      setMode("error");
      return;
    }
    window.localStorage.setItem(CLUB_CODE_KEY, code);
    codeRef.current = code;
    serverRef.current = result;
    // DB가 비어 있으면 기본 데이터(과거 공연 이력 등)로 시작한다.
    const ready = result.users.length > 0 ? normalizeData(result) : createInitialData();
    setData(ready);
    setMode("remote");
    save(ready);
  }

  useEffect(() => {
    setSession(readSession());
    applyTheme(readTheme());
    connect(window.localStorage.getItem(CLUB_CODE_KEY) ?? "");
    // 처음 한 번만 연결한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 다른 사람이 바꾼 내용을 가져온다. 저장 중일 때는 건너뛴다.
  // ponytail: 1분 주기 + 화면으로 돌아올 때 전체를 다시 받는다. 인원이 많아져 느려지면 Supabase 실시간 구독으로 바꿀 것.
  useEffect(() => {
    if (mode !== "remote") return;
    const refresh = async () => {
      if (pendingSaves.current > 0) return;
      const result = await loadRemote(codeRef.current).catch(() => null);
      if (!result || typeof result === "string" || pendingSaves.current > 0) return;
      serverRef.current = result;
      setData(normalizeData(result));
    };
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [mode]);

  function persist(next: AppData) {
    const synced = syncCurrentSongsToArchive(next);
    setData(synced);
    if (mode === "remote") save(synced);
    else writeData(synced);
  }

  const currentUser = data?.users.find((user) => user.id === session?.userId) ?? null;

  function login(name: string) {
    if (!data) return "데이터를 불러오는 중입니다.";
    const id = name.trim();
    const active = data.users.filter((item) => item.status === "ACTIVE");
    const user = active.find((item) => item.username === id) ?? active.find((item) => item.name === id);
    if (!user) return "등록된 아이디가 없습니다. 관리자에게 멤버 등록을 요청해주세요.";
    if (loginMode === "admin" && !isAdminRole(user.role)) return "관리자 권한이 없는 계정입니다.";
    const nextSession = { userId: user.id, portal: loginMode };
    writeSession(nextSession);
    setSession(nextSession);
    return null;
  }

  function logout() {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  if (mode === "code") return <ClubCodeScreen error={codeError} onSubmit={connect} />;

  if (mode === "error") {
    return (
      <main className="soft-shell grid min-h-screen place-items-center p-6 text-center">
        <div className="space-y-4">
          <p className="text-lg font-semibold">서버에 연결하지 못했습니다.</p>
          <button className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground" onClick={() => connect(window.localStorage.getItem(CLUB_CODE_KEY) ?? "")}>다시 시도</button>
        </div>
      </main>
    );
  }

  if (!data || mode === "loading") return <main className="soft-shell grid min-h-screen place-items-center p-6 text-sm text-muted-foreground">불러오는 중</main>;

  const banner = saveFailed && (
    <button className="fixed inset-x-4 top-3 z-50 rounded-full bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground" onClick={() => window.location.reload()}>
      저장하지 못했습니다. 눌러서 새로고침
    </button>
  );

  if (!currentUser) {
    return <>{banner}<LoginScreen mode={loginMode} setMode={setLoginMode} onLogin={login} /></>;
  }

  return (
    <>
      {banner}
      <AppShell
        key={`${currentUser.id}-${session?.portal}`}
        data={data}
        currentUser={currentUser}
        portal={session?.portal ?? "user"}
        persist={persist}
        logout={logout}
      />
    </>
  );
}
