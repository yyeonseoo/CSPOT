-- Supabase SQL Editor에서 한 번 실행한다.
-- 앱 데이터 전체를 "종류(collection) + id" 한 줄씩 저장한다. data 안에 기존 앱 객체가 그대로 들어간다.
create table if not exists public.records (
  collection text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

-- 정책을 하나도 만들지 않으므로 공개(anon) 키로는 읽기/쓰기가 모두 막힌다.
-- 앱 서버(app/api/data)만 service role 키로 접근하고, 동아리 코드를 확인한 요청만 통과시킨다.
alter table public.records enable row level security;
