-- Resolution requests (Neil, 2026-11-19): a new request type. Added on its own because Postgres can't use a new
-- enum value in the same transaction that adds it (the functions come in the next migration).
alter type public.request_kind add value if not exists 'resolution';
