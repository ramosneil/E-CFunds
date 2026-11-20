-- Security advisor fix (lint 0029): SECURITY DEFINER bodies move to the unexposed `private` schema;
-- the Data API only sees thin SECURITY INVOKER wrappers in `public`. Every private function still
-- checks the caller's role itself (require_admin / require_staff_for / is_approved).

alter function public.get_entity_report(bigint, bigint) set schema private;
alter function public.get_school_summary(bigint) set schema private;
alter function public.record_payment(bigint) set schema private;
alter function public.undo_payment(bigint, text) set schema private;
alter function public.set_entity_dues(bigint, public.dues_period, numeric) set schema private;
alter function public.file_request(bigint, public.request_kind, numeric, text, text) set schema private;
alter function public.cancel_request(bigint) set schema private;
alter function public.review_request(bigint, boolean, text) set schema private;
alter function public.admin_release(bigint, numeric, text) set schema private;
alter function public.admin_adjust(bigint, public.pocket, smallint, numeric, text) set schema private;
alter function public.reverse_entry(bigint, text) set schema private;
alter function public.close_school_year(bigint, bigint) set schema private;
alter function public.review_account(uuid, boolean, public.app_role, bigint, bigint, text) set schema private;
alter function public.disable_account(uuid, text) set schema private;
alter function public.mark_thread_read(bigint) set schema private;

create function public.get_entity_report(p_school_year_id bigint, p_semester_id bigint default null)
returns table (entity_id bigint, name text, short_name text, category public.entity_category, is_school_wide boolean,
        previous_funds numeric, openings numeric, collections numeric, expenses numeric, adjustments numeric,
        remittances numeric, releases numeric, cash_on_hand numeric, saved_with_sas numeric, total_fund numeric,
        pending_remittances numeric, pending_releases numeric, pending_expenses numeric,
        available_to_remit numeric, available_to_release numeric, members bigint, paid_members bigint, is_closed boolean)
language sql stable security invoker set search_path = '' as $$
  select * from private.get_entity_report(p_school_year_id, p_semester_id)
$$;

create function public.get_school_summary(p_school_year_id bigint)
returns table (cash_on_hand numeric, saved_with_sas numeric, total_fund numeric, expenses numeric,
        organizations bigint, clubs bigint, students bigint, pending_requests bigint)
language sql stable security invoker set search_path = '' as $$
  select * from private.get_school_summary(p_school_year_id)
$$;

create function public.record_payment(p_membership_id bigint)
returns bigint
language sql volatile security invoker set search_path = '' as $$
  select private.record_payment(p_membership_id)
$$;

create function public.undo_payment(p_membership_id bigint, p_reason text)
returns bigint
language sql volatile security invoker set search_path = '' as $$
  select private.undo_payment(p_membership_id, p_reason)
$$;

create function public.set_entity_dues(p_entity_id bigint, p_period public.dues_period, p_amount numeric)
returns void
language sql volatile security invoker set search_path = '' as $$
  select private.set_entity_dues(p_entity_id, p_period, p_amount)
$$;

create function public.file_request(p_entity_id bigint, p_kind public.request_kind, p_amount numeric, p_description text, p_attachment_path text default null)
returns bigint
language sql volatile security invoker set search_path = '' as $$
  select private.file_request(p_entity_id, p_kind, p_amount, p_description, p_attachment_path)
$$;

create function public.cancel_request(p_request_id bigint)
returns void
language sql volatile security invoker set search_path = '' as $$
  select private.cancel_request(p_request_id)
$$;

create function public.review_request(p_request_id bigint, p_approve boolean, p_remarks text default null)
returns bigint
language sql volatile security invoker set search_path = '' as $$
  select private.review_request(p_request_id, p_approve, p_remarks)
$$;

create function public.admin_release(p_entity_id bigint, p_amount numeric, p_description text)
returns bigint
language sql volatile security invoker set search_path = '' as $$
  select private.admin_release(p_entity_id, p_amount, p_description)
$$;

create function public.admin_adjust(p_entity_id bigint, p_pocket public.pocket, p_direction smallint, p_amount numeric, p_reason text)
returns bigint
language sql volatile security invoker set search_path = '' as $$
  select private.admin_adjust(p_entity_id, p_pocket, p_direction, p_amount, p_reason)
$$;

create function public.reverse_entry(p_entry_id bigint, p_reason text)
returns bigint
language sql volatile security invoker set search_path = '' as $$
  select private.reverse_entry(p_entry_id, p_reason)
$$;

create function public.close_school_year(p_entity_id bigint, p_school_year_id bigint)
returns numeric
language sql volatile security invoker set search_path = '' as $$
  select private.close_school_year(p_entity_id, p_school_year_id)
$$;

create function public.review_account(p_profile_id uuid, p_approve boolean, p_role public.app_role default null, p_entity_id bigint default null,
  p_student_id bigint default null, p_remarks text default null)
returns void
language sql volatile security invoker set search_path = '' as $$
  select private.review_account(p_profile_id, p_approve, p_role, p_entity_id, p_student_id, p_remarks)
$$;

create function public.disable_account(p_profile_id uuid, p_remarks text default null)
returns void
language sql volatile security invoker set search_path = '' as $$
  select private.disable_account(p_profile_id, p_remarks)
$$;

create function public.mark_thread_read(p_entity_id bigint)
returns integer
language sql volatile security invoker set search_path = '' as $$
  select private.mark_thread_read(p_entity_id)
$$;

revoke all on function
  private.get_entity_report(bigint, bigint),
  private.get_school_summary(bigint),
  private.record_payment(bigint),
  private.undo_payment(bigint, text),
  private.set_entity_dues(bigint, public.dues_period, numeric),
  private.file_request(bigint, public.request_kind, numeric, text, text),
  private.cancel_request(bigint),
  private.review_request(bigint, boolean, text),
  private.admin_release(bigint, numeric, text),
  private.admin_adjust(bigint, public.pocket, smallint, numeric, text),
  private.reverse_entry(bigint, text),
  private.close_school_year(bigint, bigint),
  private.review_account(uuid, boolean, public.app_role, bigint, bigint, text),
  private.disable_account(uuid, text),
  private.mark_thread_read(bigint)
from public, anon;
grant execute on function
  private.get_entity_report(bigint, bigint),
  private.get_school_summary(bigint),
  private.record_payment(bigint),
  private.undo_payment(bigint, text),
  private.set_entity_dues(bigint, public.dues_period, numeric),
  private.file_request(bigint, public.request_kind, numeric, text, text),
  private.cancel_request(bigint),
  private.review_request(bigint, boolean, text),
  private.admin_release(bigint, numeric, text),
  private.admin_adjust(bigint, public.pocket, smallint, numeric, text),
  private.reverse_entry(bigint, text),
  private.close_school_year(bigint, bigint),
  private.review_account(uuid, boolean, public.app_role, bigint, bigint, text),
  private.disable_account(uuid, text),
  private.mark_thread_read(bigint)
to authenticated;

revoke all on function
  public.get_entity_report(bigint, bigint),
  public.get_school_summary(bigint),
  public.record_payment(bigint),
  public.undo_payment(bigint, text),
  public.set_entity_dues(bigint, public.dues_period, numeric),
  public.file_request(bigint, public.request_kind, numeric, text, text),
  public.cancel_request(bigint),
  public.review_request(bigint, boolean, text),
  public.admin_release(bigint, numeric, text),
  public.admin_adjust(bigint, public.pocket, smallint, numeric, text),
  public.reverse_entry(bigint, text),
  public.close_school_year(bigint, bigint),
  public.review_account(uuid, boolean, public.app_role, bigint, bigint, text),
  public.disable_account(uuid, text),
  public.mark_thread_read(bigint)
from public, anon;
grant execute on function
  public.get_entity_report(bigint, bigint),
  public.get_school_summary(bigint),
  public.record_payment(bigint),
  public.undo_payment(bigint, text),
  public.set_entity_dues(bigint, public.dues_period, numeric),
  public.file_request(bigint, public.request_kind, numeric, text, text),
  public.cancel_request(bigint),
  public.review_request(bigint, boolean, text),
  public.admin_release(bigint, numeric, text),
  public.admin_adjust(bigint, public.pocket, smallint, numeric, text),
  public.reverse_entry(bigint, text),
  public.close_school_year(bigint, bigint),
  public.review_account(uuid, boolean, public.app_role, bigint, bigint, text),
  public.disable_account(uuid, text),
  public.mark_thread_read(bigint)
to authenticated;
