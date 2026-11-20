-- Neil (2026-11-13): "today" is Manila's day, not UTC's. The database runs on UTC, so between 00:00 and 08:00
-- Manila time current_date was still yesterday. Only two places use today's date (checked against the live
-- catalog): the ledger's default date and the accredited list's Expired check. Both now use Manila's date.
-- Exact moments (timestamptz columns) are unaffected.

alter table public.ledger_entries
  alter column occurred_on set default ((now() at time zone 'Asia/Manila')::date);

-- Same columns, same order, still security_invoker; existing grants are kept by CREATE OR REPLACE.
create or replace view public.accredited_list with (security_invoker = true) as
select a.*,
       case when a.status = 'accredited' and a.expires_on < (now() at time zone 'Asia/Manila')::date then 'expired'
            else a.status::text end as effective_status
from public.accredited_entries a;
