import { useState } from "react";
import type { ClubUser } from "@/types/domain";
import { Field, Panel, PrimaryButton } from "@/components/ui";

export function PasswordChangeScreen({ user, onChange }: { user: ClubUser; onChange: (password: string) => void }) {
  const [password, setPassword] = useState("");
  return <main className="soft-shell grid min-h-screen place-items-center p-4"><Panel title="초기 비밀번호 변경" className="w-full max-w-md"><p className="mb-5 text-sm text-muted-foreground">{user.name}님, 최초 로그인 후 비밀번호를 변경해야 합니다.</p><div className="space-y-3"><Field label="새 비밀번호" type="password" value={password} onChange={setPassword} /><PrimaryButton disabled={password.length < 6} onClick={() => onChange(password)}>변경</PrimaryButton></div></Panel></main>;
}
