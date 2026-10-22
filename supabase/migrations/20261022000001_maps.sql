-- 친구 지도 (Sky Map): 주인이 링크를 공유하면 친구가 생일을 넣고 지도에 올라온다.
-- 로그인 전 단계라 주인 확인은 주인 브라우저에만 준 비밀 토큰(해시만 저장)으로 한다.
-- 모든 표는 RLS를 켜고 정책을 두지 않는다 → 화면용 역할에서는 못 읽고, 서버(DB 주인 계정)만 읽고 쓴다.

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]{10}$'),
  owner_token_hash text not null,
  name text not null check (char_length(name) between 1 and 20),
  birth_date date not null,
  sign_key text not null,
  ip_hash text,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.map_entries (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  birth_date date not null,
  sign_key text not null,
  relation text not null check (relation in ('mirror', 'battery', 'spark', 'copilot', 'coach')),
  score int not null check (score between 1 and 99),
  ip_hash text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
create index map_entries_map_idx on public.map_entries (map_id, created_at);
create index maps_ip_idx on public.maps (ip_hash, created_at);

alter table public.maps enable row level security;
alter table public.map_entries enable row level security;
-- Supabase에는 화면용 역할(anon·authenticated)이 있고, 일반 Postgres(Neon)에는 없다 → 있을 때만 막는다
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.maps, public.map_entries from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.maps, public.map_entries from authenticated;
  end if;
end $$;
