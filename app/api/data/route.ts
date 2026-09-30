import { NextResponse, type NextRequest } from "next/server";
import { COLLECTIONS, type RecordRow } from "@/lib/remote-data";

// 브라우저는 Supabase에 직접 붙지 않고 이 라우트만 부른다. service role 키는 서버에만 있다.
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLUB_CODE = process.env.CLUB_CODE;
const PAGE = 1000;

function supabaseHeaders(extra: Record<string, string> = {}) {
  return { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra };
}

function deny(request: NextRequest) {
  // 환경 변수가 없으면 브라우저 저장소 모드로 돌도록 503을 준다.
  if (!SUPABASE_URL || !SERVICE_KEY || !CLUB_CODE) return NextResponse.json({ error: "not-configured" }, { status: 503 });
  if (request.headers.get("x-club-code") !== CLUB_CODE) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

export async function GET(request: NextRequest) {
  const denied = deny(request);
  if (denied) return denied;
  const rows: RecordRow[] = [];
  // Supabase는 한 번에 최대 1000줄만 주므로 나눠서 받는다.
  for (let from = 0; ; from += PAGE) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/records?select=collection,id,data&order=collection,id`, {
      headers: supabaseHeaders({ Range: `${from}-${from + PAGE - 1}` }),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: await response.text() }, { status: 502 });
    const page = (await response.json()) as RecordRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return NextResponse.json({ rows });
}

export async function POST(request: NextRequest) {
  const denied = deny(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { upserts?: RecordRow[]; deletes?: Array<{ collection: string; id: string }> } | null;
  const known = new Set<string>(COLLECTIONS);
  const valid = (row: { collection: unknown; id: unknown }) => typeof row?.collection === "string" && known.has(row.collection) && typeof row.id === "string" && row.id !== "";
  const upserts = body?.upserts ?? [];
  const deletes = body?.deletes ?? [];
  if (!Array.isArray(upserts) || !Array.isArray(deletes) || !upserts.every((row) => valid(row) && typeof row.data === "object" && row.data !== null) || !deletes.every(valid)) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (upserts.length > 0) {
    const updatedAt = new Date().toISOString();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/records?on_conflict=collection,id`, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(upserts.map(({ collection, id, data }) => ({ collection, id, data, updated_at: updatedAt }))),
    });
    if (!response.ok) return NextResponse.json({ error: await response.text() }, { status: 502 });
  }

  const idsByCollection = new Map<string, string[]>();
  deletes.forEach(({ collection, id }) => idsByCollection.set(collection, [...(idsByCollection.get(collection) ?? []), id]));
  for (const [collection, ids] of idsByCollection) {
    const list = ids.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(",");
    const response = await fetch(`${SUPABASE_URL}/rest/v1/records?collection=eq.${encodeURIComponent(collection)}&id=in.(${encodeURIComponent(list)})`, {
      method: "DELETE",
      headers: supabaseHeaders({ Prefer: "return=minimal" }),
    });
    if (!response.ok) return NextResponse.json({ error: await response.text() }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
