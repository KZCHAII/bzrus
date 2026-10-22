#!/usr/bin/env bash
# 로컬 테스트용 Postgres (Supabase 흉내: anon/authenticated/service_role 역할, auth.jwt())
set -euo pipefail
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
DIR=${PGDATA_DIR:-$(pwd)/.pgdata}
PORT=${PGPORT:-54329}
cmd=${1:-start}
AS=()
if [ "$(id -u)" = 0 ]; then AS=(runuser -u postgres --); mkdir -p "$DIR"; chown postgres "$DIR"; fi
if [ "$cmd" = stop ]; then "${AS[@]}" "$PGBIN/pg_ctl" -D "$DIR" stop -m fast >/dev/null 2>&1 || true; exit 0; fi
if [ ! -f "$DIR/PG_VERSION" ]; then
  "${AS[@]}" "$PGBIN/initdb" -D "$DIR" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
fi
if ! "${AS[@]}" "$PGBIN/pg_ctl" -D "$DIR" status >/dev/null 2>&1; then
  "${AS[@]}" "$PGBIN/pg_ctl" -D "$DIR" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" -l "$DIR/log" start -w >/dev/null
fi
echo "postgres://postgres@127.0.0.1:$PORT/postgres"
