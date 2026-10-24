-- 자동 작업이 하루에 한 번만 돌게 하는 기록 (예: 텔레그램 요약). 누가 주소를 여러 번 불러도 한 번만 보낸다.
create table if not exists public.cron_runs (
  job text not null check (job ~ '^[a-z_]{2,40}$'),
  day date not null,
  created_at timestamptz not null default now(),
  primary key (job, day)
);
alter table public.cron_runs enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public.cron_runs from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on public.cron_runs from authenticated; end if;
end $$;
