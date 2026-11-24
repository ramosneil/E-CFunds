-- OMSC is now OMSU (Neil, 2026-11-24): the Financial Report letterhead says "OCCIDENTAL MINDORO STATE UNIVERSITY".
-- Only the default college name is changed; anything SAS typed by hand is left alone. Website and email stay as they
-- are (SAS edits them on the School year page).
alter table public.report_settings alter column school_name set default 'OCCIDENTAL MINDORO STATE UNIVERSITY';
update public.report_settings set school_name = 'OCCIDENTAL MINDORO STATE UNIVERSITY'
 where id and school_name = 'OCCIDENTAL MINDORO STATE COLLEGE';
