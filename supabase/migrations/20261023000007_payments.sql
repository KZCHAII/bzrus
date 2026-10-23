-- 결제 (Lemon Squeezy, 판매 대행 = Merchant of Record).
-- 흐름: 리포트를 '결제 대기'로 만들고 → 결제창 → 웹훅(서명 확인) → 서버가 주문을 직접 조회해 상태·금액이 맞으면 '생성 중'으로.
alter table public.readings drop constraint if exists readings_status_check;
alter table public.readings add constraint readings_status_check check (status in ('awaiting_payment', 'generating', 'done', 'failed'));
alter table public.readings
  add column checkout_url text,
  add column pay_provider text check (pay_provider is null or pay_provider in ('lemonsqueezy')),
  add column paid_at timestamptz,
  add column amount_cents int,
  add column currency text,
  add column refunded_at timestamptz;
-- payment_id 는 이미 unique (같은 결제로 두 번 생성 안 됨)

-- 받은 결제 알림 기록 (중복·문제 확인용). 손님 정보는 담지 않는다
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_name text not null,
  order_id text,
  reading_id uuid,
  result text not null,
  test_mode boolean not null default false,
  received_at timestamptz not null default now()
);
create index payment_events_order_idx on public.payment_events (provider, order_id);
alter table public.payment_events enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public.payment_events from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on public.payment_events from authenticated; end if;
end $$;
