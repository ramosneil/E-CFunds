#!/bin/bash
# Phase 3 self-check: apply every migration to a throwaway local Postgres DB and run the
# per-role RLS + money-workflow tests. Usage: bash scripts/phase3-db-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=ecfunds_test
pg_lsclusters | grep -q online || pg_ctlcluster 16 main start
run() { su postgres -c "psql -X -q -v ON_ERROR_STOP=1 -d $DB -f '$1'" ; }
su postgres -c "psql -X -q -c 'drop database if exists $DB' -c 'create database $DB'"
run supabase/tests/local/00_supabase_shim.sql
for f in supabase/migrations/*.sql; do echo "migrate: $f"; run "$f"; done
su postgres -c "psql -X -q -v ON_ERROR_STOP=1 -o /dev/null -d $DB -f supabase/tests/rls_and_workflows.test.sql"
su postgres -c "psql -X -At -d $DB -c \"select format('PASS %s', msg) from tests.results order by n\" -c \"select format('ALL %s CHECKS PASSED', count(*)) from tests.results\""
