-- 방문·공유 통계: 쿠키 없이, 사람을 알아볼 수 없게.
-- visitor = 하루마다 바뀌는 해시(날짜+IP해시+브라우저 종류) 앞 16자리 → "오늘 몇 명"만 셀 수 있고, 날이 바뀌면 이어지지 않는다.
create table public.events (
  id bigint generated always as identity primary key,
  name text not null check (name ~ '^[a-z_]{2,40}$'),
  page text check (page is null or char_length(page) <= 40),
  ref text check (ref is null or char_length(ref) <= 60),
  src text check (src is null or char_length(src) <= 80),
  visitor text check (visitor is null or char_length(visitor) <= 32),
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
create index events_created_idx on public.events (created_at);
create index events_name_idx on public.events (name, created_at);
alter table public.events enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public.events from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on public.events from authenticated; end if;
end $$;
