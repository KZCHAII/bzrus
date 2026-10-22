-- 상세 리포트 신청 (결제 열리기 전: 출시 알림 명단). 결제를 붙이면 이 정보로 바로 리포트를 만든다.
create table public.reading_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254),
  name text not null check (char_length(name) between 1 and 20),
  birth_date date not null,
  birth_time time,
  time_unknown boolean not null default false,
  birth_place text check (birth_place is null or char_length(birth_place) <= 80),
  sign_key text not null,
  ip_hash text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (time_unknown or birth_time is not null)
);
create unique index reading_requests_email_idx on public.reading_requests (lower(email));
create index reading_requests_ip_idx on public.reading_requests (ip_hash, created_at);
alter table public.reading_requests enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public.reading_requests from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on public.reading_requests from authenticated; end if;
end $$;
