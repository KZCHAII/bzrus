-- 이메일 = 열쇠 (비밀번호·구글 로그인 없음). 이메일로 받은 링크를 누르면 그 기기가 내 페이지 주인이 되고, 산 리포트를 다시 연다.

-- 내 페이지에 이메일 연결 (선택). 리포트는 readings.email 을 그대로 쓴다.
alter table public.maps add column owner_email text check (owner_email is null or char_length(owner_email) between 3 and 254);
create index maps_owner_email_idx on public.maps (owner_email) where owner_email is not null;
create index readings_email_idx on public.readings (email) where email is not null;

-- 한 페이지에 기기별 열쇠 여러 개 (처음 만든 기기 열쇠는 maps.owner_token_hash 그대로)
create table public.map_keys (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);
create index map_keys_map_idx on public.map_keys (map_id);

-- 로그인 링크: 한 번만, 30분. 토큰은 해시만 저장
create table public.login_links (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254),
  token_hash text not null unique,
  ip_hash text,
  expires_at timestamptz not null,
  used_at timestamptz,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
create index login_links_email_idx on public.login_links (email, created_at);
create index login_links_ip_idx on public.login_links (ip_hash, created_at);

-- 보낸 메일 기록. 테스트 모드에서는 실제로 보내지 않고 여기만 남긴다 (status = 'test')
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  kind text not null check (kind in ('login', 'reading_ready', 'page_saved')),
  subject text not null,
  body_text text not null,
  status text not null check (status in ('test', 'sending', 'sent', 'failed')),
  provider_id text,
  error text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_created_idx on public.email_outbox (created_at);

alter table public.map_keys enable row level security;
alter table public.login_links enable row level security;
alter table public.email_outbox enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.map_keys, public.login_links, public.email_outbox from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.map_keys, public.login_links, public.email_outbox from authenticated;
  end if;
end $$;
