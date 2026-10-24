-- 인플루언서 페이지(친구 수천~수만 명) 대비: 관계별 상위 점수만 빨리 꺼내고, 관계별 숫자는 한 번에 센다
create index map_entries_rel_score_idx on public.map_entries (map_id, relation, score desc) where removed_at is null;
create index map_entries_ip_idx on public.map_entries (map_id, ip_hash, created_at);
