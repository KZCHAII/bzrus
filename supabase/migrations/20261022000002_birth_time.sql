-- 출생 시각(선택). 모르면 null. 상세 리포트(네 기둥·대운)에 쓴다.
alter table public.maps add column birth_time time;
alter table public.map_entries add column birth_time time;
