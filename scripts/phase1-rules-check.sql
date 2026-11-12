-- Phase 1 self-check: prototype of the E-CFunds money model on SYNTHETIC data.
-- Run: psql -v ON_ERROR_STOP=1 -f scripts/phase1-rules-check.sql   (any throwaway Postgres 14+)
-- Every check raises an exception on failure, so a clean run = all rules hold.
drop schema if exists rules_check cascade;
create schema rules_check;
set search_path = rules_check;

create type entry_kind as enum ('opening','collection','remittance','release','expense','adjustment','reversal');

create table ledger_entries (
  id          bigserial primary key,
  entity_id   int  not null,
  school_year text not null,
  kind        entry_kind not null,
  amount      numeric(12,2) not null check (amount > 0),
  pocket      text check (pocket in ('saved','cash')),      -- adjustment/reversal only
  direction   smallint check (direction in (-1, 1)),         -- adjustment/reversal only
  description text
);

-- Effect of each entry on the two pockets (see docs/business-rules.md §2)
create view entry_effects as
select l.*,
  case kind when 'opening'    then  amount
            when 'remittance' then  amount
            when 'release'    then -amount
            when 'adjustment' then case when pocket = 'saved' then direction * amount else 0 end
            when 'reversal'   then case when pocket = 'saved' then direction * amount else 0 end
            else 0 end as d_saved,
  case kind when 'collection' then  amount
            when 'remittance' then -amount
            when 'release'    then  amount
            when 'expense'    then -amount
            when 'adjustment' then case when pocket = 'cash'  then direction * amount else 0 end
            when 'reversal'   then case when pocket = 'cash'  then direction * amount else 0 end
            else 0 end as d_cash
from ledger_entries l;

create view entity_balances as
select entity_id,
  sum(d_saved)           as saved_with_sas,
  sum(d_cash)            as cash_on_hand,
  sum(d_saved + d_cash)  as total_fund
from entry_effects group by entity_id;

-- Year view: previous funds = everything before the year; activity within the year
create view entity_year as
select y.entity_id, y.school_year,
  coalesce((select sum(d_saved + d_cash) from entry_effects p
            where p.entity_id = y.entity_id and p.school_year < y.school_year), 0)
  + coalesce(sum(amount) filter (where kind = 'opening'), 0)                     as previous_funds,
  coalesce(sum(amount) filter (where kind = 'collection'), 0)                    as collections,
  coalesce(sum(amount) filter (where kind = 'remittance'), 0)                    as remitted,
  coalesce(sum(amount) filter (where kind = 'release'), 0)                       as released,
  coalesce(sum(amount) filter (where kind = 'expense'), 0)                       as expenses
from entry_effects y group by y.entity_id, y.school_year;

create or replace function assert(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'CHECK FAILED: %', msg; end if; raise notice 'ok  %', msg; end $$;

-- ── Scenario (synthetic): entity 1, school year 2026-2027 ──────────────────────
insert into ledger_entries (entity_id, school_year, kind, amount, description) values
 (1,'2025-2026','opening',   10000,'migrated carry-over (old previous_funds)'),
 (1,'2026-2027','collection',  405,'27 students x 15'),
 (1,'2026-2027','remittance',  300,'treasurer remits, SAS approves'),
 (1,'2026-2027','release',    2000,'budget: Sports Fest'),
 (1,'2026-2027','expense',    1800,'Sports Fest supplies (approved, receipt)');
insert into ledger_entries (entity_id, school_year, kind, amount, pocket, direction, description) values
 (1,'2026-2027','reversal', 15, 'cash', -1, 'student marked Paid by mistake -> reversed');

select assert((select saved_with_sas from entity_balances where entity_id=1) = 10000 + 300 - 2000,
              'saved = opening + remitted - released');
select assert((select cash_on_hand from entity_balances where entity_id=1) = 405 - 300 + 2000 - 1800 - 15,
              'cash = collections - remitted + released - expenses + adjustments');
select assert((select total_fund from entity_balances where entity_id=1) = 10000 + 405 - 1800 - 15,
              'total = opening + collections - expenses (remit/release are internal transfers)');
select assert((select total_fund from entity_balances where entity_id=1)
            = (select saved_with_sas + cash_on_hand from entity_balances where entity_id=1),
              'total always equals the two pockets');
select assert((select previous_funds from entity_year where entity_id=1 and school_year='2026-2027') = 10000,
              'previous funds for a year = closing total of all earlier years');

-- Turnover rule: year can close only when cash_on_hand = 0 → remit the rest, then check
insert into ledger_entries (entity_id, school_year, kind, amount, description)
select 1,'2026-2027','remittance', cash_on_hand,'turnover remittance' from entity_balances where entity_id=1;
select assert((select cash_on_hand from entity_balances where entity_id=1) = 0, 'after turnover remittance cash = 0');
select assert((select saved_with_sas from entity_balances where entity_id=1) = 10000 + 405 - 1800 - 15,
              'after turnover everything is saved with SAS = next officers'' previous funds');

-- ── Old-system parity on the May-10 dump shape (no remits/releases/expenses) ───
-- Old org page: prev + fees + released - remitted - expenses. With the dump's values
-- (prev 10000, fees 405, rest 0) old = 10405; new total for same inputs must match.
insert into ledger_entries (entity_id, school_year, kind, amount) values
 (2,'2025-2026','opening',10000),(2,'2026-2027','collection',405);
select assert((select total_fund from entity_balances where entity_id=2) = 10405,
              'parity: SSG dump numbers (old Remaining Funds = 10,405)');
select 'ALL CHECKS PASSED' as result;
