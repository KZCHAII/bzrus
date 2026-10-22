-- 상세 리포트 (AI). 글은 서버가 계산한 사주 원국을 AI에게 넘겨 만들고, 카드는 그 글에서 뽑는다.
-- 보기는 링크의 비밀 키(view_key)로만. 결제가 붙으면 payment_id로 한 번만.
create table public.readings (
  id uuid primary key default gen_random_uuid(),
  view_key text not null,
  email text check (email is null or char_length(email) between 3 and 254),
  name text not null check (char_length(name) between 1 and 20),
  birth_date date not null,
  birth_time time,
  time_unknown boolean not null default false,
  gender text not null check (gender in ('woman', 'man')),
  sign_key text not null,
  status text not null default 'generating' check (status in ('generating', 'done', 'failed')),
  attempts int not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  content text,
  error text,
  cards jsonb,
  cards_status text check (cards_status is null or cards_status in ('generating', 'done', 'failed')),
  cards_at timestamptz,
  prompt_version text not null,
  payment_id text unique,
  ip_hash text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  check (time_unknown or birth_time is not null),
  check (status <> 'done' or content is not null)
);
create index readings_created_idx on public.readings (created_at);
create index readings_ip_idx on public.readings (ip_hash, created_at);
alter table public.readings enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public.readings from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on public.readings from authenticated; end if;
end $$;

-- 예약 신청: 출생지는 이제 받지 않음 (사주는 출생지 없이 계산)
alter table public.reading_requests alter column birth_place drop not null;
alter table public.reading_requests add column gender text check (gender is null or gender in ('woman', 'man'));
