-- Phase 3 self-check: RLS per role + money workflows (docs/business-rules.md).
-- Runs on the local throwaway DB built by scripts/phase3-db-test.sh. Any failed check aborts.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create schema tests;
grant usage on schema tests to anon, authenticated;
create table tests.results (n serial, ok boolean, msg text);
grant insert, select on tests.results to anon, authenticated;
grant usage on sequence tests.results_n_seq to anon, authenticated;

create function tests.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAILED: %', msg; end if;
  insert into tests.results (ok, msg) values (true, msg);
end $$;
-- true when the statement raises (run with the CURRENT role, i.e. RLS + grants apply)
create function tests.fails(sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    insert into tests.results (ok, msg) values (true, msg || '  [' || left(sqlerrm, 70) || ']');
    return;
  end;
  raise exception 'FAILED (expected an error): %', msg;
end $$;
create function tests.login(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false)
$$;
create function tests.money(p_entity text, p_col text) returns numeric language plpgsql as $$
declare v numeric; y bigint;
begin
  select id into y from public.school_years where label = '2026-2027';
  execute format('select %I from public.get_entity_report($1) where short_name = $2', p_col) into v using y, p_entity;
  return v;
end $$;
grant execute on all functions in schema tests to anon, authenticated;

-- =========================== Setup (as the database owner) ===========================
insert into public.school_years (label, starts_on, ends_on, is_current) values
  ('2025-2026', '2025-08-01', '2026-07-31', false),
  ('2026-2027', '2026-08-01', '2027-07-31', true);
insert into public.semesters (school_year_id, term, starts_on, ends_on, is_current)
select id, 1, '2026-08-01', '2026-12-20', true from public.school_years where label = '2026-2027';
insert into public.entities (name, short_name, category, is_school_wide, dues_period, dues_amount) values
  ('Supreme Student Government', 'SSG', 'organization', true, 'school_year', 15),
  ('JOES', 'JOES', 'organization', false, 'semester', 20),
  ('PADC', 'PADC', 'organization', false, 'semester', 35),
  ('Sports Club', 'Sports', 'club', false, 'semester', 20);
insert into public.students (student_no, full_name) values
  ('2024-0317', 'Test Student One'), ('2024-0318', 'Test Student Two'), ('2024-0319', 'Test Student Three');

-- Sign-ups (the trigger makes pending profiles from what people asked for)
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@test', '{"full_name":"SAS Admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'joes@test', '{"requested_role":"treasurer","requested_entity_id":"2"}'),
  ('a0000000-0000-0000-0000-000000000003', 'padc@test', '{"requested_role":"treasurer","requested_entity_id":"3"}'),
  ('a0000000-0000-0000-0000-000000000004', 'stu1@test', '{"requested_role":"student","student_no":"2024-0317"}'),
  ('a0000000-0000-0000-0000-000000000005', 'pending@test', '{"requested_role":"student","student_no":"2024-0318"}'),
  ('a0000000-0000-0000-0000-000000000006', 'rogue@test', '{"requested_role":"admin"}'),
  ('a0000000-0000-0000-0000-000000000007', 'joes2@test', '{"requested_role":"treasurer","requested_entity_id":"2"}');

select tests.ok((select count(*) = 7 from public.profiles where status = 'pending' and role is null),
  'sign-up: every new user gets a PENDING profile with no role');
select tests.ok((select requested_role is null from public.profiles where email = 'rogue@test'),
  'sign-up: asking to be admin is ignored');
select tests.ok((select requested_student_no = '2024-0317' from public.profiles where email = 'stu1@test'),
  'sign-up: student number request recorded');

-- Bootstrap the first admin (Phase 4 seed does exactly this, as the DB owner)
update public.profiles set status = 'approved', role = 'admin' where email = 'admin@test';

-- Opening balance from the previous school year (migration-only kind), JOES ₱3,400
insert into public.ledger_entries (entity_id, school_year_id, kind, amount, description)
select e.id, y.id, 'opening', 3400, 'Previous funds carried over'
from public.entities e, public.school_years y where e.short_name = 'JOES' and y.label = '2025-2026';

-- =========================== Not signed in (anon) ===========================
set role anon;
select tests.fails('select * from public.entities', 'anon: cannot read entities');
select tests.fails('select * from public.ledger_entries', 'anon: cannot read ledger');
select tests.fails('select public.get_entity_report(1)', 'anon: cannot call reports');
select tests.fails('select public.record_payment(1)', 'anon: cannot call money functions');
reset role;

-- =========================== Pending user ===========================
select tests.login('a0000000-0000-0000-0000-000000000005'); set role authenticated;
select tests.ok((select count(*) = 4 from public.entities), 'pending: can list orgs/clubs (for the sign-up form)');
select tests.ok((select count(*) = 0 from public.school_years), 'pending: sees no school years');
select tests.ok((select count(*) = 0 from public.students), 'pending: sees no roster');
select tests.fails('select * from public.get_entity_report(2)', 'pending: cannot read reports');
select tests.fails($$update public.profiles set status = 'approved', role = 'admin' where id = auth.uid()$$,
  'pending: cannot approve itself');
select public.set_my_request('treasurer', (select id from public.entities where short_name = 'JOES'), null, 'Pat Pending');
select tests.ok((select requested_role = 'treasurer' and requested_entity_id is not null and requested_student_no is null
                   and full_name = 'Pat Pending' and status = 'pending' from public.profiles where id = auth.uid()),
  'pending: can change what it asks for (role, org, name) but stays pending');
select tests.fails($$select public.set_my_request('admin')$$, 'pending: cannot ask to be admin');
select tests.fails($$select public.set_my_request('treasurer', 999999)$$, 'pending: treasurer must pick a real org/club');
select tests.fails($$select public.set_my_request('student', null, ' x ')$$, 'pending: student must give a student ID');
select public.set_my_request('student', null, '2024-0318');
select tests.ok((select requested_role = 'student' and requested_entity_id is null and requested_student_no = '2024-0318'
                 from public.profiles where id = auth.uid()), 'pending: switching to student clears the org');
reset role;

-- =========================== Admin approves accounts ===========================
select tests.login('a0000000-0000-0000-0000-000000000001'); set role authenticated;
select tests.ok((select count(*) = 7 from public.profiles), 'admin: reads all profiles');
select public.review_account('a0000000-0000-0000-0000-000000000002', true, 'treasurer', (select id from public.entities where short_name = 'JOES'));
select public.review_account('a0000000-0000-0000-0000-000000000003', true, 'treasurer', (select id from public.entities where short_name = 'PADC'));
select public.review_account('a0000000-0000-0000-0000-000000000004', true, 'student', null, (select id from public.students where student_no = '2024-0317'));
select public.review_account('a0000000-0000-0000-0000-000000000006', false, null, null, null, 'Not a real officer');
select tests.fails($$select public.review_account('a0000000-0000-0000-0000-000000000007', true, 'treasurer', (select id from public.entities where short_name = 'JOES'))$$,
  'admin: a second active treasurer for the same org is refused');
select tests.fails($$select public.review_account('a0000000-0000-0000-0000-000000000001', true, 'student', null, 1)$$,
  'admin: cannot review own account');
reset role;
select tests.login('a0000000-0000-0000-0000-000000000004'); set role authenticated;
select tests.fails($$select public.set_my_request('treasurer', 2)$$, 'approved user: cannot change its request any more');
reset role;

-- =========================== Treasurer (JOES) ===========================
select tests.login('a0000000-0000-0000-0000-000000000002'); set role authenticated;
select tests.ok((select count(*) = 1 from public.profiles), 'treasurer: reads only own profile');
select tests.ok((select count(*) = 3 from public.students), 'treasurer: reads the roster (to add members)');
select public.set_entity_dues((select id from public.entities where short_name = 'JOES'), 'semester', 20);
select tests.fails($$select public.set_entity_dues((select id from public.entities where short_name = 'PADC'), 'semester', 1)$$,
  'treasurer: cannot set another org''s dues');
update public.entities set name = 'Hacked' where short_name = 'JOES';   -- RLS: matches 0 rows
select tests.ok((select name = 'JOES' from public.entities where short_name = 'JOES'),
  'treasurer: cannot edit entities directly (update changes nothing)');

insert into public.memberships (student_id, entity_id, school_year_id, semester_id, amount_due)
select s.id, e.id, y.id, sem.id, 20
from public.students s, public.entities e, public.school_years y, public.semesters sem
where s.student_no in ('2024-0317', '2024-0318') and e.short_name = 'JOES' and y.label = '2026-2027' and sem.school_year_id = y.id;
select tests.ok((select count(*) = 2 from public.memberships), 'treasurer: adds unpaid memberships to own org');
select tests.fails($$insert into public.memberships (student_id, entity_id, school_year_id, amount_due)
  select s.id, e.id, y.id, 35 from public.students s, public.entities e, public.school_years y
  where s.student_no = '2024-0319' and e.short_name = 'PADC' and y.label = '2026-2027'$$,
  'treasurer: cannot add members to another org');
select tests.fails($$insert into public.memberships (student_id, entity_id, school_year_id, amount_due, is_paid, paid_at)
  select s.id, e.id, y.id, 20, true, now() from public.students s, public.entities e, public.school_years y
  where s.student_no = '2024-0319' and e.short_name = 'JOES' and y.label = '2026-2027'$$,
  'treasurer: cannot insert a membership as already paid');

select public.record_payment(m.id) from public.memberships m order by m.id;
select tests.ok(tests.money('JOES', 'collections') = 40, 'dues: 2 × ₱20 collected');
select tests.fails($$select public.record_payment((select min(id) from public.memberships))$$, 'dues: cannot mark paid twice');
select tests.fails($$insert into public.ledger_entries (entity_id, school_year_id, kind, amount, description) values (2, 2, 'collection', 999, 'fake')$$,
  'treasurer: cannot write the ledger directly');
select tests.fails($$update public.memberships set is_paid = false, paid_at = null$$, 'treasurer: cannot flip paid status directly');
update public.memberships set amount_due = 1 where is_paid;   -- RLS: matches 0 rows
select tests.ok((select bool_and(amount_due = 20) from public.memberships), 'treasurer: cannot change amount after payment');

-- Requests (cash 40, saved 3400)
select public.file_request(2, 'remittance', 30, 'Remit week 1');
select tests.fails($$select public.file_request(2, 'remittance', 20, 'Too much')$$, 'requests: remit over available cash (40 − 30 pending) refused');
select tests.fails($$select public.file_request(2, 'expense', 5, 'No receipt')$$, 'requests: expense without receipt refused');
select public.file_request(2, 'expense', 10, 'Markers', '2/markers.jpg');
select public.file_request(2, 'release', 3400, 'Acquaintance Party budget', '2/budget.pdf');
select tests.fails($$select public.file_request(2, 'release', 1, 'One more peso')$$, 'requests: release over available saved refused');
select tests.fails($$select public.file_request(3, 'remittance', 1, 'For PADC')$$, 'requests: cannot file for another org');
select tests.fails($$select public.review_request((select min(id) from public.fund_requests), true)$$, 'treasurer: cannot approve requests');
select tests.fails($$select public.admin_release(2, 1, 'self release')$$, 'treasurer: cannot release funds directly');
select tests.ok((select count(*) = 3 from public.fund_requests), 'treasurer: sees own requests');
select tests.ok(tests.money('JOES', 'available_to_remit') = 0, 'report: available to remit = 40 − 30 − 10 = 0');
insert into public.messages (entity_id, sender_id, body) values (2, auth.uid(), 'Remit filed, please review');
select tests.fails($$insert into public.messages (entity_id, sender_id, body) values (3, auth.uid(), 'Wrong thread')$$, 'messages: cannot post in another org''s thread');
select tests.fails($$insert into public.messages (entity_id, sender_id, body) values (null, auth.uid(), 'Broadcast')$$, 'messages: treasurer cannot broadcast');
reset role;

-- =========================== Other treasurer (PADC) is walled off ===========================
select tests.login('a0000000-0000-0000-0000-000000000003'); set role authenticated;
select tests.ok((select count(*) = 0 from public.ledger_entries), 'isolation: PADC sees no JOES ledger rows');
select tests.ok((select count(*) = 0 from public.fund_requests), 'isolation: PADC sees no JOES requests');
select tests.ok((select count(*) = 0 from public.memberships), 'isolation: PADC sees no JOES memberships');
select tests.ok((select count(*) = 0 from public.messages), 'isolation: PADC sees no JOES messages');
select tests.fails('select public.record_payment(1)', 'isolation: PADC cannot record JOES payments even with the real id');
select tests.ok((select count(*) = 4 from public.get_entity_report(2)), 'PADC: still sees every org''s aggregate report');
reset role;

-- =========================== Student ===========================
select tests.login('a0000000-0000-0000-0000-000000000004'); set role authenticated;
select tests.ok((select count(*) = 0 from public.ledger_entries), 'student: no transaction-level ledger');
select tests.ok((select count(*) = 0 from public.fund_requests), 'student: no requests');
select tests.ok((select count(*) = 1 from public.memberships), 'student: sees only own dues');
select tests.ok((select count(*) = 1 from public.students), 'student: sees only own roster row');
select tests.ok((select count(*) = 0 from public.messages), 'student: no messages');
select tests.ok((select count(*) = 0 from public.audit_log), 'student: no audit log');
select tests.ok((select paid_members = 2 and members = 2 from public.get_entity_report(2) where short_name = 'JOES'),
  'student: sees paid COUNTS in the report');
select tests.fails($$select public.record_payment((select min(id) from public.memberships))$$, 'student: cannot record payments');
select tests.fails($$select public.file_request(2, 'remittance', 1, 'x')$$, 'student: cannot file requests');
select tests.fails($$insert into public.students (student_no, full_name) values ('9999-0001', 'Fake')$$, 'student: cannot add roster students');
reset role;

-- =========================== Admin reviews (two-pocket rules) ===========================
select tests.login('a0000000-0000-0000-0000-000000000001'); set role authenticated;
select tests.ok(tests.money('JOES', 'total_fund') = 3440, 'before: total 3440 = previous 3400 + dues 40');
select public.review_request((select id from public.fund_requests where kind = 'remittance'), true);
select tests.ok(tests.money('JOES', 'cash_on_hand') = 10 and tests.money('JOES', 'saved_with_sas') = 3430
  and tests.money('JOES', 'total_fund') = 3440, 'remit 30: cash 40→10, saved 3400→3430, total unchanged');
select tests.fails($$select public.review_request((select id from public.fund_requests where kind = 'expense'), false)$$,
  'review: reject needs a reason');
select public.review_request((select id from public.fund_requests where kind = 'expense'), false, 'Not an org expense');
select public.review_request((select id from public.fund_requests where kind = 'release'), true);
select tests.ok(tests.money('JOES', 'cash_on_hand') = 3410 and tests.money('JOES', 'saved_with_sas') = 30
  and tests.money('JOES', 'total_fund') = 3440, 'release 3400: saved 3430→30, cash 10→3410, total unchanged');
select tests.fails($$select public.review_request((select id from public.fund_requests where kind = 'release'), true)$$,
  'review: cannot approve twice');
select tests.ok(tests.money('JOES', 'previous_funds') = 3400 and tests.money('JOES', 'remittances') = 30
  and tests.money('JOES', 'releases') = 3400, 'report: previous funds, remittances, releases');
reset role;

-- Treasurer undoes one payment, files + gets an expense approved; admin reverses it
select tests.login('a0000000-0000-0000-0000-000000000002'); set role authenticated;
select tests.fails($$select public.undo_payment((select max(id) from public.memberships), '')$$, 'undo: needs a reason');
select public.undo_payment((select max(id) from public.memberships), 'Recorded on the wrong student');
select tests.ok(tests.money('JOES', 'collections') = 20 and tests.money('JOES', 'total_fund') = 3420, 'undo paid: collections 40→20 via reversal');
select tests.ok((select count(*) = 1 from public.memberships where is_paid), 'undo paid: membership back to unpaid');
select public.file_request(2, 'expense', 100, 'Venue deposit', '2/venue.jpg');
reset role;
select tests.login('a0000000-0000-0000-0000-000000000001'); set role authenticated;
select public.review_request((select max(id) from public.fund_requests), true);
select tests.ok(tests.money('JOES', 'expenses') = 100 and tests.money('JOES', 'total_fund') = 3320, 'expense 100: total 3420→3320');
select public.reverse_entry((select max(id) from public.ledger_entries where kind = 'expense'), 'Duplicate receipt');
select tests.ok(tests.money('JOES', 'expenses') = 0 and tests.money('JOES', 'total_fund') = 3420, 'reversal: expense cancelled, total back to 3420');
select tests.fails($$select public.reverse_entry((select max(id) from public.ledger_entries where kind = 'expense'), 'again')$$, 'reversal: only once');
select tests.fails($$select public.admin_adjust(2, 'saved', -1::smallint, 999999, 'too much')$$, 'adjust: cannot push a pocket below zero');
select tests.ok((select count(*) > 0 from public.audit_log), 'admin: reads the audit log');
select tests.ok(tests.money('JOES', 'cash_on_hand') + tests.money('JOES', 'saved_with_sas') = tests.money('JOES', 'total_fund'),
  'invariant: total = cash + saved');
select tests.ok(tests.money('JOES', 'previous_funds') + tests.money('JOES', 'openings') + tests.money('JOES', 'collections')
  - tests.money('JOES', 'expenses') + tests.money('JOES', 'adjustments') = tests.money('JOES', 'total_fund'),
  'invariant: total = previous + collections − expenses ± adjustments');

-- Messages + accredited list
insert into public.messages (entity_id, sender_id, body) values (null, auth.uid(), 'Reminder to all treasurers');
select tests.ok(public.mark_thread_read(2) = 1, 'messages: admin marks the JOES thread read');
insert into public.accredited_entries (name, category, adviser, academic_year, accredited_on, expires_on)
values ('JOES', 'organization', 'Adviser A', '2026-2027', '2026-08-15', '2025-01-01');
update public.accredited_entries set adviser = 'Adviser B';
select tests.ok((select count(*) = 2 from public.accredited_history where before_row is not null or after_row is not null),
  'accredited: history keeps full before/after rows');
select tests.ok((select effective_status = 'expired' from public.accredited_list), 'accredited: expired is derived from the date');

-- Turnover: cash must be zero
select tests.fails($$select public.close_school_year(2, 2)$$, 'turnover: refused while cash is on hand');
reset role;
select tests.login('a0000000-0000-0000-0000-000000000002'); set role authenticated;
select tests.ok((select count(*) = 2 from public.messages), 'treasurer: sees own thread + broadcast');
select tests.fails($$insert into public.accredited_entries (name, category) values ('X', 'club')$$, 'treasurer: cannot edit accredited list');
select public.file_request(2, 'remittance', tests.money('JOES', 'cash_on_hand'), 'Turnover: remit all cash');
reset role;
select tests.login('a0000000-0000-0000-0000-000000000001'); set role authenticated;
select public.review_request((select max(id) from public.fund_requests), true);
select tests.ok(public.close_school_year(2, 2) = 3420, 'turnover: closes with total 3420, all saved');
select tests.fails($$select public.admin_adjust(2, 'saved', 1::smallint, 1, 'late entry')$$, 'turnover: no new entries in a closed year');
reset role;

-- Next year: previous funds are computed, never typed
insert into public.school_years (label, starts_on, ends_on) values ('2027-2028', '2027-08-01', '2028-07-31');
select tests.login('a0000000-0000-0000-0000-000000000001'); set role authenticated;
select tests.ok((select previous_funds = 3420 and saved_with_sas = 3420 and cash_on_hand = 0
  from public.get_entity_report((select id from public.school_years where label = '2027-2028')) where short_name = 'JOES'),
  'next year: previous funds = 3420 = closing total');
reset role;

-- Membership limit: 1 organization + 1 club per year; SSG exempt
select tests.login('a0000000-0000-0000-0000-000000000003'); set role authenticated;
select tests.fails($$insert into public.memberships (student_id, entity_id, school_year_id, amount_due)
  select s.id, e.id, y.id, 35 from public.students s, public.entities e, public.school_years y
  where s.student_no = '2024-0317' and e.short_name = 'PADC' and y.label = '2026-2027'$$,
  'membership: 2nd organization in a year refused');
reset role;
insert into public.memberships (student_id, entity_id, school_year_id, amount_due)
select s.id, e.id, y.id, 15 from public.students s, public.entities e, public.school_years y
where s.student_no = '2024-0317' and e.short_name in ('SSG', 'Sports') and y.label = '2026-2027';
select tests.ok((select count(*) = 3 from public.memberships m join public.students s on s.id = m.student_id
  where s.student_no = '2024-0317'), 'membership: org + club + SSG allowed');

-- Ledger is append-only even for the database owner
select tests.fails('update public.ledger_entries set amount = 1', 'ledger: UPDATE blocked for everyone');
select tests.fails('delete from public.ledger_entries', 'ledger: DELETE blocked for everyone');

-- Disabled accounts lose access immediately
select tests.login('a0000000-0000-0000-0000-000000000001'); set role authenticated;
select public.disable_account('a0000000-0000-0000-0000-000000000003', 'Term ended');
reset role;
select tests.login('a0000000-0000-0000-0000-000000000003'); set role authenticated;
select tests.fails('select * from public.get_entity_report(2)', 'disabled: loses report access');
select tests.ok((select count(*) = 0 from public.school_years), 'disabled: sees nothing');
reset role;

-- Bootstrap admin: only a VERIFIED email on the private list is promoted, once
insert into private.bootstrap_admins (email) values ('boss@test');
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000008', 'Boss@test');
select tests.ok((select status = 'pending' from public.profiles where id = 'a0000000-0000-0000-0000-000000000008'),
  'bootstrap admin: unverified sign-up stays pending');
update auth.users set email_confirmed_at = now() where id = 'a0000000-0000-0000-0000-000000000008';
select tests.ok((select status = 'approved' and role = 'admin' from public.profiles where id = 'a0000000-0000-0000-0000-000000000008'),
  'bootstrap admin: becomes admin once the email is verified');
select tests.ok((select count(*) = 0 from private.bootstrap_admins), 'bootstrap admin: list entry is used up');
insert into auth.users (id, email, email_confirmed_at) values ('a0000000-0000-0000-0000-000000000009', 'boss@test.other', now());
select tests.ok((select status = 'pending' from public.profiles where id = 'a0000000-0000-0000-0000-000000000009'),
  'bootstrap admin: any other verified email stays pending');
set role authenticated;
select tests.fails('select * from private.bootstrap_admins', 'bootstrap admin: signed-in users cannot read the list');
reset role;

-- Student ID sign-in helpers: server function only (service_role), lockout after 5 failures in 15 minutes
select tests.ok(not has_function_privilege('anon', 'public.student_login_lookup(text)', 'execute')
            and not has_function_privilege('authenticated', 'public.student_login_lookup(text)', 'execute')
            and not has_function_privilege('authenticated', 'public.student_login_record(text, boolean)', 'execute'),
  'student login: browser roles cannot look up emails or write attempts');
select tests.ok(has_function_privilege('service_role', 'public.student_login_lookup(text)', 'execute'),
  'student login: the server function (service_role) can');
select tests.ok((select email = 'stu1@test' and locked_until is null from public.student_login_lookup(' 2024-0317 ')),
  'student login: an approved student ID resolves to its email (trimmed), not locked');
select tests.ok((select email is null from public.student_login_lookup('2024-0318')),
  'student login: a pending student ID resolves to nothing');
select public.student_login_record('2024-0317', false) from generate_series(1, 4);
select tests.ok((select locked_until is null from public.student_login_lookup('2024-0317')), 'student login: 4 failures, not locked');
select public.student_login_record('2024-0317', false);
select tests.ok((select locked_until > now() from public.student_login_lookup('2024-0317')), 'student login: 5th failure locks the ID');
update private.login_attempts set at = at - interval '16 minutes' where student_no = '2024-0317';
select tests.ok((select locked_until is null from public.student_login_lookup('2024-0317')), 'student login: lock ends after 15 minutes');

select format('%s checks passed', count(*)) as result from tests.results;
