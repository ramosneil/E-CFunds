-- Terms & Conditions acceptance (Neil, 2026-11-13). Sign-up requires ticking "I agree to the Terms and Privacy
-- Notice"; the moment is saved on the profile. Email sign-ups send it in the sign-up metadata (copied below);
-- Google sign-ups accept on the first-time "Tell SAS who you are" screen (accept_terms()).

alter table public.profiles add column terms_accepted_at timestamptz;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  req_role public.app_role;
begin
  begin
    req_role := nullif(meta ->> 'requested_role', '')::public.app_role;
  exception when invalid_text_representation then
    req_role := null;
  end;
  if req_role = 'admin' then req_role := null; end if;   -- nobody can ask to be admin

  insert into public.profiles (id, email, full_name, requested_role, requested_entity_id, requested_student_no,
                               terms_accepted_at)
  values (
    new.id,
    new.email,
    left(coalesce(meta ->> 'full_name', meta ->> 'name'), 200),
    req_role,
    case when req_role = 'treasurer' and (meta ->> 'requested_entity_id') ~ '^\d{1,18}$'
         then (meta ->> 'requested_entity_id')::bigint end,
    case when req_role = 'student' then left(meta ->> 'student_no', 30) end,
    case when meta ->> 'terms_accepted' = 'true' then now() end
  );
  return new;
end $$;

-- Signed-in person accepts the Terms (first acceptance is kept).
create or replace function private.accept_terms()
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v timestamptz;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  update public.profiles set terms_accepted_at = coalesce(terms_accepted_at, now())
   where id = (select auth.uid())
  returning terms_accepted_at into v;
  return v;
end $$;
revoke all on function private.accept_terms() from public, anon;
grant execute on function private.accept_terms() to authenticated;

create function public.accept_terms()
returns timestamptz language sql volatile security invoker set search_path = '' as $$
  select private.accept_terms()
$$;
revoke all on function public.accept_terms() from public, anon;
grant execute on function public.accept_terms() to authenticated;
